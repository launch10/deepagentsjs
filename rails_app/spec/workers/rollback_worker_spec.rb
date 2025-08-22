require 'rails_helper'
require 'sidekiq/testing'
require 'support/website_file_helpers'

RSpec.describe RollbackWorker, type: :worker do
  include WebsiteFileHelpers
  
  let(:website) do
    site = FactoryBot.create(:website)
    site.website_files.create!(minimal_website_files)
    site.snapshot
    site
  end
  let(:deploy) do
    d = FactoryBot.create(:deploy, :completed, website: website)
    d.update!(
      version_path: "#{website.id}/20240101120000",
      revertible: true,
      is_live: false
    )
    d
  end
  let(:worker) { RollbackWorker.new }

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

    it 'has 3 retries' do
      expect(described_class.sidekiq_options['retry']).to eq(3)
    end

    it 'includes backtrace' do
      expect(described_class.sidekiq_options['backtrace']).to be true
    end
  end

  describe '#perform' do
    context 'with a valid deploy' do
      before do
        allow(Deploy).to receive(:find).with(deploy.id).and_return(deploy)
        allow(deploy).to receive(:actually_rollback).and_return(true)
      end

      it 'calls actually_rollback on the deploy' do
        expect(deploy).to receive(:actually_rollback)
        worker.perform(deploy.id)
      end

      it 'returns true on success' do
        result = worker.perform(deploy.id)
        expect(result).to be true
      end

      it 'logs success' do
        expect(Rails.logger).to receive(:info).with("Starting async rollback for deploy #{deploy.id}, website #{deploy.website_id}")
        expect(Rails.logger).to receive(:info).with("Successfully rolled back deploy #{deploy.id}")
        worker.perform(deploy.id)
      end
    end

    context 'when rollback fails' do
      before do
        allow(Deploy).to receive(:find).with(deploy.id).and_return(deploy)
        allow(deploy).to receive(:actually_rollback).and_return(false)
      end

      it 'raises an error' do
        expect {
          worker.perform(deploy.id)
        }.to raise_error(StandardError, "Rollback failed for deploy #{deploy.id}")
      end

      it 'logs the failure' do
        expect(Rails.logger).to receive(:error).with("Failed to rollback deploy #{deploy.id}")
        expect(Rails.logger).to receive(:error).with("Error rolling back deploy #{deploy.id}: Rollback failed for deploy #{deploy.id}")
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
        expect(Rails.logger).to receive(:error).with(/Deploy 999999 not found for rollback/)
        expect { worker.perform(999999) }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context 'when an unexpected error occurs' do
      before do
        allow(Deploy).to receive(:find).with(deploy.id).and_return(deploy)
        allow(deploy).to receive(:actually_rollback).and_raise(StandardError, "Unexpected error")
      end

      it 're-raises the error' do
        expect {
          worker.perform(deploy.id)
        }.to raise_error(StandardError, "Unexpected error")
      end

      it 'logs the error' do
        expect(Rails.logger).to receive(:error).with("Error rolling back deploy #{deploy.id}: Unexpected error")
        expect { worker.perform(deploy.id) }.to raise_error(StandardError)
      end
    end
  end

  describe 'retry behavior' do
    it 'retries with faster backoff for critical rollbacks' do
      retry_in = described_class.sidekiq_retry_in_block
      
      expect(retry_in.call(0, StandardError.new)).to eq(30)      # 30 seconds
      expect(retry_in.call(1, StandardError.new)).to eq(120)     # 2 minutes
      expect(retry_in.call(2, StandardError.new)).to eq(600)     # 10 minutes
      expect(retry_in.call(3, StandardError.new)).to eq(:kill)   # Stop retrying
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
        "Failed to rollback deploy #{deploy.id} after 3 retries: Test error"
      )
      expect(Rails.logger).to receive(:error).with(
        "CRITICAL: Rollback failed for website #{deploy.website_id}, deploy #{deploy.id}"
      )
      
      described_class.sidekiq_retries_exhausted_block.call(msg, exception)
    end

    it 'logs a critical alert' do
      expect(Rails.logger).to receive(:error).ordered.with(
        "Failed to rollback deploy #{deploy.id} after 3 retries: Test error"
      )
      expect(Rails.logger).to receive(:error).ordered.with(
        "CRITICAL: Rollback failed for website #{deploy.website_id}, deploy #{deploy.id}"
      )
      
      described_class.sidekiq_retries_exhausted_block.call(msg, exception)
    end
  end

  describe 'async enqueueing' do
    it 'can be enqueued' do
      expect {
        RollbackWorker.perform_async(deploy.id)
      }.to change(RollbackWorker.jobs, :size).by(1)
    end

    it 'enqueues with correct arguments' do
      RollbackWorker.perform_async(deploy.id)
      
      job = RollbackWorker.jobs.last
      expect(job['args']).to eq([deploy.id])
      expect(job['queue']).to eq('critical')
    end
  end
end