require 'rails_helper'

RSpec.describe CampaignDeploy::DeployWorker, type: :worker do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:deploy) { create(:campaign_deploy, campaign: campaign) }
  let(:job_run) { create(:job_run, :with_langgraph_callback, account: account) }

  before { mock_google_ads_client }

  describe '#perform' do
    context 'without job_run_id' do
      it 'calls actually_deploy on the deploy' do
        allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
        expect(deploy).to receive(:actually_deploy).with(async: true, job_run_id: nil).and_return(false)
        described_class.new.perform(deploy.id)
      end

      it 'raises an error for Sidekiq retry when deploy fails' do
        allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
        allow(deploy).to receive(:actually_deploy).and_raise(CampaignDeploy::StepNotFinishedError)

        expect {
          described_class.new.perform(deploy.id)
        }.to raise_error(CampaignDeploy::StepNotFinishedError)
      end
    end

    context 'with job_run_id' do
      it 'marks job_run as running on first iteration (pending → running)' do
        allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
        allow(deploy).to receive(:actually_deploy).and_return(false)

        expect {
          described_class.new.perform(deploy.id, job_run.id)
        }.to change { job_run.reload.status }.from("pending").to("running")
      end

      it 'does not update job_run if already running' do
        job_run.update!(status: "running", started_at: 1.hour.ago)
        allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
        allow(deploy).to receive(:actually_deploy).and_return(false)

        # Should still process without changing started_at
        expect(deploy).to receive(:actually_deploy).with(async: true, job_run_id: job_run.id)
        expect { described_class.new.perform(deploy.id, job_run.id) }
          .not_to change { job_run.reload.started_at }
      end

      context 'when deploy completes (no more steps)' do
        it 'completes the job_run' do
          job_run.update!(status: "running", started_at: Time.current)
          allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_return(true)  # Signal completion

          described_class.new.perform(deploy.id, job_run.id)

          expect(job_run.reload.status).to eq("completed")
        end

        it 'notifies Langgraph of completion' do
          job_run.update!(status: "running", started_at: Time.current)
          allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_return(true)

          expect(LanggraphCallbackWorker).to receive(:perform_async)
            .with(job_run.id, hash_including(status: "completed"))

          described_class.new.perform(deploy.id, job_run.id)
        end

        it 'includes campaign details in the result' do
          job_run.update!(status: "running", started_at: Time.current)
          allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_return(true)

          expect(LanggraphCallbackWorker).to receive(:perform_async)
            .with(job_run.id, hash_including(
              result: hash_including(
                campaign_id: deploy.campaign_id,
                campaign_deploy_id: deploy.id,
                status: "completed"
              )
            ))

          described_class.new.perform(deploy.id, job_run.id)
        end
      end

      context 'when more steps remain' do
        it 'does not complete the job_run' do
          job_run.update!(status: "running", started_at: Time.current)
          allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_return(false)  # More steps

          described_class.new.perform(deploy.id, job_run.id)

          expect(job_run.reload.status).to eq("running")
        end

        it 'does not notify Langgraph' do
          job_run.update!(status: "running", started_at: Time.current)
          allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_return(false)

          expect(LanggraphCallbackWorker).not_to receive(:perform_async)

          described_class.new.perform(deploy.id, job_run.id)
        end
      end

      context 'when deploy raises an error' do
        # Note: We intentionally do NOT notify Langgraph immediately on error.
        # Sidekiq will retry, and we only notify when retries are exhausted.
        # This prevents the race condition where Langgraph sees "failed" but
        # a subsequent retry might succeed.

        it 'does not notify Langgraph immediately (waits for retries to exhaust)' do
          job_run.update!(status: "running", started_at: Time.current)
          allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_raise(StandardError, "Something went wrong")

          expect(LanggraphCallbackWorker).not_to receive(:perform_async)

          expect {
            described_class.new.perform(deploy.id, job_run.id)
          }.to raise_error(StandardError, "Something went wrong")
        end

        it 'does not mark job_run as failed (allows retries)' do
          job_run.update!(status: "running", started_at: Time.current)
          allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_raise(StandardError, "Something went wrong")

          expect {
            described_class.new.perform(deploy.id, job_run.id)
          }.to raise_error(StandardError)

          # Job run stays "running" - only fails when retries exhaust
          expect(job_run.reload.status).to eq("running")
        end

        it 're-raises error for Sidekiq retry' do
          job_run.update!(status: "running", started_at: Time.current)
          allow(CampaignDeploy).to receive(:find).with(deploy.id).and_return(deploy)
          allow(deploy).to receive(:actually_deploy).and_raise(CampaignDeploy::StepNotFinishedError)

          expect {
            described_class.new.perform(deploy.id, job_run.id)
          }.to raise_error(CampaignDeploy::StepNotFinishedError)
        end
      end
    end
  end

  describe 'sidekiq_retries_exhausted' do
    context 'without job_run_id' do
      it 'marks the deploy as failed' do
        msg = { 'args' => [deploy.id], 'retry_count' => 5 }
        ex = StandardError.new('Test error')

        described_class.sidekiq_retries_exhausted_block.call(msg, ex)

        expect(deploy.reload.status).to eq('failed')
      end

      it 'stores the stacktrace' do
        msg = { 'args' => [deploy.id], 'retry_count' => 5 }
        ex = StandardError.new('Test error')
        ex.set_backtrace(['line1', 'line2'])

        described_class.sidekiq_retries_exhausted_block.call(msg, ex)

        expect(deploy.reload.stacktrace).to include('Test error')
        expect(deploy.reload.stacktrace).to include('line1')
      end
    end

    context 'with job_run_id' do
      it 'marks the deploy as failed' do
        msg = { 'args' => [deploy.id, job_run.id], 'retry_count' => 5 }
        ex = StandardError.new('Step failed')

        described_class.sidekiq_retries_exhausted_block.call(msg, ex)

        expect(deploy.reload.status).to eq('failed')
      end

      it 'fails the job_run' do
        msg = { 'args' => [deploy.id, job_run.id], 'retry_count' => 5 }
        ex = StandardError.new('Step failed')

        described_class.sidekiq_retries_exhausted_block.call(msg, ex)

        expect(job_run.reload.status).to eq('failed')
      end

      it 'notifies Langgraph of failure' do
        msg = { 'args' => [deploy.id, job_run.id], 'retry_count' => 5 }
        ex = StandardError.new('Step failed')

        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed", error: "Step failed"))

        described_class.sidekiq_retries_exhausted_block.call(msg, ex)
      end

      it 'propagates diagnostic details to Langgraph callback' do
        msg = { 'args' => [deploy.id, job_run.id], 'retry_count' => 5 }
        diagnostic_message = 'Step create_ads did not complete successfully. Diagnostic: [{:resource_type=>:ad_group_ad, :action=>:not_found}] | Run errors: [{:resource_type=>:ad_group_ad, :action=>:error, :error=>"policy_finding_error: POLICY_FINDING: A policy was violated"}]'
        ex = CampaignDeploy::StepNotFinishedError.new(diagnostic_message)

        expect(LanggraphCallbackWorker).to receive(:perform_async)
          .with(job_run.id, hash_including(status: "failed", error: diagnostic_message))

        described_class.sidekiq_retries_exhausted_block.call(msg, ex)
      end

      it 'does not fail already-finished job_run' do
        job_run.update!(status: "completed", completed_at: Time.current)
        msg = { 'args' => [deploy.id, job_run.id], 'retry_count' => 5 }
        ex = StandardError.new('Step failed')

        expect(LanggraphCallbackWorker).not_to receive(:perform_async)

        described_class.sidekiq_retries_exhausted_block.call(msg, ex)

        expect(job_run.reload.status).to eq('completed')  # Unchanged
      end
    end
  end
end
