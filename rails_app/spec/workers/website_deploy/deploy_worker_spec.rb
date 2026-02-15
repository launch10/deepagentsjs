require 'rails_helper'
require 'sidekiq/testing'

RSpec.describe WebsiteDeploy::DeployWorker, type: :worker do
  include WebsiteFileHelpers

  let(:website) do
    site = FactoryBot.create(:website)
    site.website_files.create!(minimal_website_files)
    site.snapshot
    site
  end
  let(:deploy) { FactoryBot.create(:website_deploy, website: website) }
  let(:job_run) { create(:job_run, :with_langgraph_callback, account: website.account, job_class: "WebsiteDeploy") }
  let(:worker) { WebsiteDeploy::DeployWorker.new }

  before do
    Sidekiq::Testing.fake!
  end

  after do
    Sidekiq::Worker.clear_all
  end

  describe 'configuration' do
    it 'uses the critical queue' do
      expect(described_class.sidekiq_options['queue']).to eq(:critical)
    end

    it 'has 5 retries' do
      expect(described_class.sidekiq_options['retry']).to eq(5)
    end

    it 'includes backtrace' do
      expect(described_class.sidekiq_options['backtrace']).to be true
    end
  end

  describe '#perform' do
    context 'when deploy is already terminal' do
      it 'returns true without deploying when deploy is skipped' do
        deploy.update!(status: "skipped")
        allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)

        expect(deploy).not_to receive(:actually_deploy)
        result = worker.perform(deploy.id)
        expect(result).to be true
      end

      it 'returns true without deploying when deploy is failed' do
        deploy.update!(status: "failed")
        allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)

        expect(deploy).not_to receive(:actually_deploy)
        result = worker.perform(deploy.id)
        expect(result).to be true
      end

      it 'returns true without deploying when deploy is completed' do
        deploy.update!(status: "completed")
        allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)

        expect(deploy).not_to receive(:actually_deploy)
        result = worker.perform(deploy.id)
        expect(result).to be true
      end
    end

    context 'when job_run is already finished' do
      it 'returns true without deploying' do
        job_run.update!(status: "failed", started_at: 1.minute.ago, completed_at: Time.current, error_message: "superseded")
        allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)

        expect(deploy).not_to receive(:actually_deploy)
        result = worker.perform(deploy.id, job_run.id)
        expect(result).to be true
      end
    end

    context 'without job_run_id' do
      before do
        allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)
        allow(deploy).to receive(:actually_deploy).and_return(true)
      end

      it 'calls actually_deploy on the deploy' do
        expect(deploy).to receive(:actually_deploy)
        worker.perform(deploy.id)
      end

      it 'returns true on success' do
        result = worker.perform(deploy.id)
        expect(result).to be true
      end

      it 'logs success' do
        expect(Rails.logger).to receive(:info).with("Starting deploy #{deploy.id} for website #{deploy.website_id} (job_run: none)")
        expect(Rails.logger).to receive(:info).with("Successfully deployed #{deploy.id}")
        worker.perform(deploy.id)
      end
    end

    context 'with job_run_id' do
      it 'transitions job_run through running before completing' do
        allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)

        # Capture the job_run status at the time actually_deploy is called
        status_during_deploy = nil
        allow(deploy).to receive(:actually_deploy) do
          status_during_deploy = job_run.reload.status
          true
        end

        worker.perform(deploy.id, job_run.id)

        expect(status_during_deploy).to eq("running")
        expect(job_run.reload.started_at).to be_present
      end

      it 'does not update job_run if already running' do
        job_run.update!(status: "running", started_at: 1.hour.ago)
        allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)
        allow(deploy).to receive(:actually_deploy).and_return(true)

        expect { worker.perform(deploy.id, job_run.id) }
          .not_to change { job_run.reload.started_at }
      end

      context 'when deploy succeeds' do
        before do
          job_run.update!(status: "running", started_at: Time.current)
          allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_return(true)
        end

        it 'completes the job_run' do
          worker.perform(deploy.id, job_run.id)
          expect(job_run.reload.status).to eq("completed")
        end

        it 'notifies Langgraph of completion' do
          expect(LanggraphCallbackWorker).to receive(:perform_async)
            .with(job_run.id, hash_including(status: "completed"))

          worker.perform(deploy.id, job_run.id)
        end

        it 'includes website details in the result' do
          expect(LanggraphCallbackWorker).to receive(:perform_async)
            .with(job_run.id, hash_including(
              result: hash_including(
                website_id: deploy.website_id,
                deploy_id: deploy.id,
                status: "completed"
              )
            ))

          worker.perform(deploy.id, job_run.id)
        end
      end

      context 'when deploy fails (returns false)' do
        before do
          job_run.update!(status: "running", started_at: Time.current)
          allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_return(false)
        end

        it 'fails the job_run' do
          expect { worker.perform(deploy.id, job_run.id) }.to raise_error(StandardError)
          expect(job_run.reload.status).to eq("failed")
        end

        it 'notifies Langgraph of failure' do
          expect(LanggraphCallbackWorker).to receive(:perform_async)
            .with(job_run.id, hash_including(status: "failed", error: "Website deploy failed"))

          expect { worker.perform(deploy.id, job_run.id) }.to raise_error(StandardError)
        end
      end

      context 'when deploy raises an exception' do
        before do
          job_run.update!(status: "running", started_at: Time.current)
          allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_raise(StandardError, "Unexpected error")
        end

        it 'does not notify Langgraph immediately (waits for retries to exhaust)' do
          expect(LanggraphCallbackWorker).not_to receive(:perform_async)

          expect {
            worker.perform(deploy.id, job_run.id)
          }.to raise_error(StandardError, "Unexpected error")
        end

        it 'does not mark job_run as failed (allows retries)' do
          expect {
            worker.perform(deploy.id, job_run.id)
          }.to raise_error(StandardError)

          expect(job_run.reload.status).to eq("running")
        end

        it 're-raises error for Sidekiq retry' do
          expect {
            worker.perform(deploy.id, job_run.id)
          }.to raise_error(StandardError, "Unexpected error")
        end
      end
    end

    context 'when deploy is not found' do
      it 'raises ActiveRecord::RecordNotFound' do
        expect {
          worker.perform(999999)
        }.to raise_error(ActiveRecord::RecordNotFound)
      end

      it 'logs the error' do
        expect(Rails.logger).to receive(:error).with(/Deploy 999999 not found/)
        expect { worker.perform(999999) }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context 'when an unexpected error occurs' do
      before do
        allow(WebsiteDeploy).to receive(:find).with(deploy.id).and_return(deploy)
        allow(deploy).to receive(:actually_deploy).and_raise(StandardError, "Unexpected error")
      end

      it 're-raises the error' do
        expect {
          worker.perform(deploy.id)
        }.to raise_error(StandardError, "Unexpected error")
      end

      it 'logs the error' do
        expect(Rails.logger).to receive(:error).with("Error deploying #{deploy.id}: Unexpected error")
        expect { worker.perform(deploy.id) }.to raise_error(StandardError)
      end
    end
  end

  describe 'retry behavior' do
    it 'uses Sidekiq default retry behavior' do
      expect(described_class.sidekiq_options['retry']).to eq(5)
    end
  end

  describe 'retries exhausted' do
    let(:exception) { StandardError.new("Test error") }

    before do
      exception.set_backtrace(['line1', 'line2', 'line3'])
      allow(WebsiteDeploy).to receive(:find_by).with(id: deploy.id).and_return(deploy)
    end

    context 'without job_run_id' do
      let(:msg) do
        {
          'args' => [deploy.id],
          'retry_count' => 5
        }
      end

      it 'logs the exhausted retries' do
        expect(Rails.logger).to receive(:error).with(
          "Failed to deploy #{deploy.id} after 5 retries: Test error"
        )

        described_class.sidekiq_retries_exhausted_block.call(msg, exception)
      end

      it 'marks the deploy as failed' do
        deploy.update!(status: 'pending')
        allow(deploy).to receive(:update!)

        expect(deploy).to receive(:update!).with(
          hash_including(
            status: 'failed',
            stacktrace: /Sidekiq retries exhausted: Test error/
          )
        )

        described_class.sidekiq_retries_exhausted_block.call(msg, exception)
      end
    end

    context 'with job_run_id' do
      let(:msg) do
        {
          'args' => [deploy.id, job_run.id],
          'retry_count' => 5
        }
      end

      it 'marks the deploy as failed' do
        described_class.sidekiq_retries_exhausted_block.call(msg, exception)
        expect(deploy.reload.status).to eq('failed')
      end

      it 'fails the job_run' do
        described_class.sidekiq_retries_exhausted_block.call(msg, exception)
        expect(job_run.reload.status).to eq('failed')
      end

      it 'notifies Langgraph of failure' do
        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed", error: "Test error"))

        described_class.sidekiq_retries_exhausted_block.call(msg, exception)
      end

      it 'does not fail already-finished job_run' do
        job_run.update!(status: "completed", completed_at: Time.current)

        expect(LanggraphCallbackWorker).not_to receive(:perform_async)

        described_class.sidekiq_retries_exhausted_block.call(msg, exception)

        expect(job_run.reload.status).to eq('completed')
      end
    end
  end

  describe 'async enqueueing' do
    it 'can be enqueued without job_run_id' do
      expect {
        WebsiteDeploy::DeployWorker.perform_async(deploy.id)
      }.to change(WebsiteDeploy::DeployWorker.jobs, :size).by(1)
    end

    it 'enqueues with correct arguments (no job_run_id)' do
      WebsiteDeploy::DeployWorker.perform_async(deploy.id)

      job = WebsiteDeploy::DeployWorker.jobs.last
      expect(job['args']).to eq([deploy.id])
      expect(job['queue']).to eq('critical')
    end

    it 'can be enqueued with job_run_id' do
      expect {
        WebsiteDeploy::DeployWorker.perform_async(deploy.id, job_run.id)
      }.to change(WebsiteDeploy::DeployWorker.jobs, :size).by(1)
    end

    it 'enqueues with correct arguments (with job_run_id)' do
      WebsiteDeploy::DeployWorker.perform_async(deploy.id, job_run.id)

      job = WebsiteDeploy::DeployWorker.jobs.last
      expect(job['args']).to eq([deploy.id, job_run.id])
      expect(job['queue']).to eq('critical')
    end
  end
end
