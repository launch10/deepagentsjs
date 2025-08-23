require 'rails_helper'
RSpec.describe Cloudflare::BlockWorker, type: :worker do
  describe '#perform' do
    let(:firewall) { create(:firewall) }
    let(:rule) { create(:firewall_rule, firewall: firewall, status: 'pending') }
    let(:firewall_service) { instance_double(Cloudflare::FirewallService) }
    
    before do
      allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
    end
    
    context 'when blocking succeeds' do
      let(:cloudflare_response) do
        {
          'result' => {
            'id' => 'cf_rule_123',
            'expression' => '(http.host eq "spam.example.com")',
            'action' => 'block',
            'description' => 'Auto-blocked: spam.example.com'
          },
          'success' => true
        }
      end
      
      before do
        allow(firewall_service).to receive(:create_rule).and_return(cloudflare_response)
      end
      
      it 'creates rule in Cloudflare' do
        expect(firewall_service).to receive(:create_rule).with(
          expression: rule.build_cloudflare_expression,
          action: 'block',
          description: "Auto-blocked: #{rule.domain}"
        )
        
        subject.perform(rule.id)
      end
      
      it 'updates rule status to blocked' do
        subject.perform(rule.id)
        
        expect(rule.reload).to have_attributes(
          status: 'blocked',
          cloudflare_rule_id: 'cf_rule_123'
        )
      end
      
      it 'sets blocked_at timestamp' do
        Timecop.freeze do
          subject.perform(rule.id)
          expect(rule.reload.blocked_at).to eq(Time.current)
        end
      end
      
      it 'updates status to blocking before API call' do
        expect(firewall_service).to receive(:create_rule) do
          expect(rule.reload.status).to eq('blocking')
          cloudflare_response
        end
        
        subject.perform(rule.id)
      end
    end
    
    context 'when Cloudflare API returns error' do
      let(:error_response) do
        {
          'errors' => [
            { 'code' => 10014, 'message' => 'Rate limit exceeded' }
          ],
          'success' => false
        }
      end
      
      before do
        allow(firewall_service).to receive(:create_rule).and_return(error_response)
      end
      
      it 'marks rule as failed' do
        subject.perform(rule.id)
        
        expect(rule.reload).to have_attributes(
          status: 'failed',
          last_error: 'Rate limit exceeded'
        )
      end
      
      it 'increments error count' do
        expect {
          subject.perform(rule.id)
        }.to change { rule.reload.error_count }.from(0).to(1)
      end
      
      it 'raises error for Sidekiq retry' do
        expect {
          subject.perform(rule.id)
        }.to raise_error(Cloudflare::BlockWorker::BlockingError, /Rate limit exceeded/)
      end
    end
    
    context 'when Cloudflare API raises exception' do
      before do
        allow(firewall_service).to receive(:create_rule).and_raise(Cloudflare::FirewallService::ApiError.new('Connection timeout'))
      end
      
      it 'marks rule as failed' do
        expect { subject.perform(rule.id) }.to raise_error(Cloudflare::FirewallService::ApiError)
        
        expect(rule.reload).to have_attributes(
          status: 'failed',
          last_error: 'Connection timeout'
        )
      end
      
      it 'raises error for Sidekiq retry' do
        expect {
          subject.perform(rule.id)
        }.to raise_error(Cloudflare::FirewallService::ApiError)
      end
    end
    
    context 'when rule does not exist' do
      it 'raises ActiveRecord::RecordNotFound' do
        expect {
          subject.perform(999999)
        }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
    
    context 'when rule is already blocked' do
      let(:rule) { create(:firewall_rule, firewall: firewall, status: 'blocked', cloudflare_rule_id: 'existing_id') }
      
      it 'does not call Cloudflare API' do
        expect(firewall_service).not_to receive(:create_rule)
        subject.perform(rule.id)
      end
      
      it 'returns early without changes' do
        original_attributes = rule.attributes
        subject.perform(rule.id)
        expect(rule.reload.attributes).to eq(original_attributes)
      end
    end
    
    context 'when rule is in unblocked state' do
      let(:rule) { create(:firewall_rule, firewall: firewall, status: 'unblocked') }
      
      it 'processes the block request' do
        allow(firewall_service).to receive(:create_rule).and_return(
          'result' => { 'id' => 'new_cf_rule' },
          'success' => true
        )
        
        subject.perform(rule.id)
        expect(rule.reload.status).to eq('blocked')
      end
    end
  end
  
  describe 'Sidekiq configuration' do
    it 'uses the cloudflare queue' do
      expect(described_class.sidekiq_options['queue']).to eq(:cloudflare)
    end
    
    it 'has retry configuration' do
      expect(described_class.sidekiq_options['retry']).to eq(5)
    end
    
    it 'has retry configuration with custom backoff' do
      expect(described_class).to respond_to(:sidekiq_retry_in_block)
    end
  end
  
  describe '.sidekiq_retries_exhausted' do
    let(:firewall) { create(:firewall) }
    let(:rule) { create(:firewall_rule, firewall: firewall, status: 'blocking') }
    let(:job) do
      {
        'args' => [rule.id],
        'error_message' => 'Maximum retries exceeded',
        'error_class' => 'Cloudflare::BlockWorker::BlockingError'
      }
    end
    
    before do
      allow(Rollbar).to receive(:error)
    end
    
    it 'marks rule as permanently failed' do
      described_class.sidekiq_retries_exhausted_block.call(job)
      
      expect(rule.reload).to have_attributes(
        status: 'failed',
        last_error: 'Maximum retries exceeded after 5 attempts'
      )
    end
    
    it 'logs to Rollbar' do
      expect(Rollbar).to receive(:error).with(
        'Cloudflare blocking failed after max retries',
        hash_including(
          firewall_rule_id: rule.id,
          domain: rule.domain,
          error: 'Maximum retries exceeded'
        )
      )
      
      described_class.sidekiq_retries_exhausted_block.call(job)
    end
    
    it 'notifies user if configured' do
      allow(BlockingFailureMailer).to receive(:max_retries_exceeded).and_return(double(deliver_later: true))
      
      expect(BlockingFailureMailer).to receive(:max_retries_exceeded).with(rule)
      
      described_class.sidekiq_retries_exhausted_block.call(job)
    end
  end
end

RSpec.describe Cloudflare::BlockWorker::BatchWorker, type: :worker do
  describe '#perform' do
    let(:user) { create(:user) }
    let(:firewall1) { create(:firewall, user: user) }
    let(:firewall2) { create(:firewall, user: user) }
    let(:other_user_firewall) { create(:firewall) }
    
    let!(:pending_rule1) { create(:firewall_rule, firewall: firewall1, status: 'pending') }
    let!(:pending_rule2) { create(:firewall_rule, firewall: firewall1, status: 'pending') }
    let!(:pending_rule3) { create(:firewall_rule, firewall: firewall2, status: 'pending') }
    let!(:blocked_rule) { create(:firewall_rule, firewall: firewall1, status: 'blocked') }
    let!(:failed_rule) { create(:firewall_rule, firewall: firewall1, status: 'failed', last_attempted_at: 2.hours.ago) }
    let!(:recent_failed_rule) { create(:firewall_rule, firewall: firewall1, status: 'failed', last_attempted_at: 5.minutes.ago) }
    let!(:other_user_rule) { create(:firewall_rule, firewall: other_user_firewall, status: 'pending') }
    
    before do
      allow(Cloudflare::BlockWorker).to receive(:perform_async)
    end
    
    context 'when processing rules for a user' do
      it 'enqueues BlockWorker for all pending rules' do
        subject.perform(user.id)
        
        expect(Cloudflare::BlockWorker).to have_received(:perform_async).with(pending_rule1.id)
        expect(Cloudflare::BlockWorker).to have_received(:perform_async).with(pending_rule2.id)
        expect(Cloudflare::BlockWorker).to have_received(:perform_async).with(pending_rule3.id)
      end
      
      it 'enqueues BlockWorker for retryable failed rules' do
        subject.perform(user.id)
        
        expect(Cloudflare::BlockWorker).to have_received(:perform_async).with(failed_rule.id)
      end
      
      it 'does not enqueue BlockWorker for recently failed rules' do
        subject.perform(user.id)
        
        expect(Cloudflare::BlockWorker).not_to have_received(:perform_async).with(recent_failed_rule.id)
      end
      
      it 'does not enqueue BlockWorker for already blocked rules' do
        subject.perform(user.id)
        
        expect(Cloudflare::BlockWorker).not_to have_received(:perform_async).with(blocked_rule.id)
      end
      
      it 'does not enqueue rules from other users' do
        subject.perform(user.id)
        
        expect(Cloudflare::BlockWorker).not_to have_received(:perform_async).with(other_user_rule.id)
      end
      
      it 'updates failed rules status to blocking' do
        subject.perform(user.id)
        
        expect(failed_rule.reload.status).to eq('blocking')
      end
      
      it 'returns count of rules processed' do
        count = subject.perform(user.id)
        expect(count).to eq(4) # 3 pending + 1 retryable failed
      end
    end
    
    context 'when user has no firewalls' do
      let(:user_without_firewalls) { create(:user) }
      
      it 'returns 0' do
        count = subject.perform(user_without_firewalls.id)
        expect(count).to eq(0)
      end
      
      it 'does not enqueue any workers' do
        subject.perform(user_without_firewalls.id)
        expect(Cloudflare::BlockWorker).not_to have_received(:perform_async)
      end
    end
    
    context 'when user does not exist' do
      it 'raises ActiveRecord::RecordNotFound' do
        expect {
          subject.perform(999999)
        }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
    
    context 'with rate limiting' do
      let!(:many_rules) { create_list(:firewall_rule, 100, firewall: firewall1, status: 'pending') }
      
      it 'processes rules in batches with delays' do
        expect(Cloudflare::BlockWorker).to receive(:perform_in).at_least(:once)
        subject.perform(user.id)
      end
      
      it 'spaces out jobs over time' do
        delays = []
        allow(Cloudflare::BlockWorker).to receive(:perform_in) do |delay, rule_id|
          delays << delay
        end
        
        subject.perform(user.id)
        
        # Check that delays increase for each batch
        batch_delays = delays.each_slice(10).map(&:first).compact
        expect(batch_delays).to eq(batch_delays.sort)
      end
    end
  end
  
  describe 'Sidekiq configuration' do
    it 'uses the cloudflare_batch queue' do
      expect(described_class.sidekiq_options['queue']).to eq(:cloudflare_batch)
    end
    
    it 'has limited retries' do
      expect(described_class.sidekiq_options['retry']).to eq(3)
    end
  end
end