require 'rails_helper'
require 'sidekiq/testing'
require 'support/website_file_helpers'

RSpec.describe Deploy::DeployWorker, type: :worker do
  include WebsiteFileHelpers
  
  let(:website) do
    site = FactoryBot.create(:website)
    site.website_files.create!(minimal_website_files)
    site.snapshot
    site
  end
  let(:deploy) { FactoryBot.create(:deploy, website: website) }
  let(:worker) { Deploy::DeployWorker.new }

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
    context 'with a valid deploy' do
      before do
        allow(Deploy).to receive(:find).with(deploy.id).and_return(deploy)
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
        expect(Rails.logger).to receive(:info).with("Starting async deploy #{deploy.id} for website #{deploy.website_id}")
        expect(Rails.logger).to receive(:info).with("Successfully deployed #{deploy.id}")
        worker.perform(deploy.id)
      end
    end

    context 'when deploy fails' do
      before do
        allow(Deploy).to receive(:find).with(deploy.id).and_return(deploy)
        allow(deploy).to receive(:actually_deploy).and_return(false)
      end

      it 'raises an error' do
        expect {
          worker.perform(deploy.id)
        }.to raise_error(StandardError, "Deploy #{deploy.id} failed")
      end

      it 'logs the failure' do
        expect(Rails.logger).to receive(:error).with("Failed to deploy #{deploy.id}")
        expect(Rails.logger).to receive(:error).with("Error deploying #{deploy.id}: Deploy #{deploy.id} failed")
        expect { worker.perform(deploy.id) }.to raise_error(StandardError)
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
        allow(Deploy).to receive(:find).with(deploy.id).and_return(deploy)
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
      # DeployWorker uses default Sidekiq retry behavior (exponential backoff)
      # The retry count is configured to 5
      expect(described_class.sidekiq_options['retry']).to eq(5)
    end
  end

  describe 'retries exhausted' do
    let(:msg) do
      {
        'args' => [deploy.id],
        'retry_count' => 3
      }
    end
    let(:exception) { StandardError.new("Test error") }

    before do
      allow(Deploy).to receive(:find_by).with(id: deploy.id).and_return(deploy)
    end

    it 'logs the exhausted retries' do
      expect(Rails.logger).to receive(:error).with(
        "Failed to deploy #{deploy.id} after 3 retries: Test error"
      )
      
      described_class.sidekiq_retries_exhausted_block.call(msg, exception)
    end

    context 'when deploy exists and is not already failed' do
      before do
        deploy.update!(status: 'pending')
        allow(deploy).to receive(:update!)
      end

      it 'marks the deploy as failed' do
        expect(deploy).to receive(:update!).with(
          hash_including(
            status: 'failed',
            stacktrace: /Sidekiq retries exhausted: Test error/
          )
        )
        
        described_class.sidekiq_retries_exhausted_block.call(msg, exception)
      end
    end
  end

  describe 'async enqueueing' do
    it 'can be enqueued' do
      expect {
        Deploy::DeployWorker.perform_async(deploy.id)
      }.to change(Deploy::DeployWorker.jobs, :size).by(1)
    end

    it 'enqueues with correct arguments' do
      Deploy::DeployWorker.perform_async(deploy.id)
      
      job = Deploy::DeployWorker.jobs.last
      expect(job['args']).to eq([deploy.id])
      expect(job['queue']).to eq('critical')
    end
  end
end