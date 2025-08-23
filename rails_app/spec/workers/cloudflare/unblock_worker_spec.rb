require 'rails_helper'

RSpec.describe Cloudflare::UnblockWorker, type: :worker do
  describe '#perform' do
    let(:firewall) { create(:firewall) }
    let(:rule) { create(:firewall_rule, firewall: firewall, status: 'blocked', cloudflare_rule_id: 'cf_rule_123', blocked_at: 1.day.ago) }
    let(:firewall_service) { instance_double(Cloudflare::FirewallService) }
    
    before do
      allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
    end
    
    context 'when unblocking succeeds' do
      let(:cloudflare_response) do
        {
          'result' => { 'id' => 'cf_rule_123' },
          'success' => true
        }
      end
      
      before do
        allow(firewall_service).to receive(:delete_rule).and_return(cloudflare_response)
      end
      
      it 'deletes rule from Cloudflare' do
        expect(firewall_service).to receive(:delete_rule).with('cf_rule_123')
        subject.perform(rule.id)
      end
      
      it 'updates rule status to unblocked' do
        subject.perform(rule.id)
        
        expect(rule.reload).to have_attributes(
          status: 'unblocked',
          cloudflare_rule_id: nil
        )
      end
      
      it 'sets unblocked_at timestamp' do
        Timecop.freeze do
          subject.perform(rule.id)
          expect(rule.reload.unblocked_at).to eq(Time.current)
        end
      end
      
      it 'preserves blocked_at timestamp' do
        original_blocked_at = rule.blocked_at
        subject.perform(rule.id)
        expect(rule.reload.blocked_at).to eq(original_blocked_at)
      end
      
      it 'updates status to unblocking before API call' do
        expect(firewall_service).to receive(:delete_rule) do
          expect(rule.reload.status).to eq('unblocking')
          cloudflare_response
        end
        
        subject.perform(rule.id)
      end
      
      it 'updates firewall has_blocked_domains when last rule unblocked' do
        firewall.update(has_blocked_domains: true)
        
        subject.perform(rule.id)
        
        expect(firewall.reload.has_blocked_domains).to be false
      end
    end
    
    context 'when Cloudflare rule not found (already deleted)' do
      let(:error_response) do
        {
          'errors' => [
            { 'code' => 10008, 'message' => 'Firewall rule not found' }
          ],
          'success' => false
        }
      end
      
      before do
        allow(firewall_service).to receive(:delete_rule).and_return(error_response)
      end
      
      it 'marks rule as unblocked anyway' do
        subject.perform(rule.id)
        
        expect(rule.reload).to have_attributes(
          status: 'unblocked',
          cloudflare_rule_id: nil
        )
      end
      
      it 'sets unblocked_at timestamp' do
        Timecop.freeze do
          subject.perform(rule.id)
          expect(rule.reload.unblocked_at).to eq(Time.current)
        end
      end
      
      it 'logs the inconsistency' do
        expect(Rails.logger).to receive(:warn).with(/Rule cf_rule_123 not found in Cloudflare/)
        subject.perform(rule.id)
      end
    end
    
    context 'when Cloudflare API returns other error' do
      let(:error_response) do
        {
          'errors' => [
            { 'code' => 10014, 'message' => 'Rate limit exceeded' }
          ],
          'success' => false
        }
      end
      
      before do
        allow(firewall_service).to receive(:delete_rule).and_return(error_response)
      end
      
      it 'marks rule as failed' do
        subject.perform(rule.id)
        
        expect(rule.reload).to have_attributes(
          status: 'failed',
          last_error: 'Rate limit exceeded',
          cloudflare_rule_id: 'cf_rule_123' # Keeps the ID for retry
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
        }.to raise_error(Cloudflare::UnblockWorker::UnblockingError, /Rate limit exceeded/)
      end
    end
    
    context 'when Cloudflare API raises exception' do
      before do
        allow(firewall_service).to receive(:delete_rule).and_raise(Cloudflare::FirewallService::ApiError.new('Connection timeout'))
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
    
    context 'when rule is not blocked' do
      let(:rule) { create(:firewall_rule, firewall: firewall, status: 'pending') }
      
      it 'raises InvalidStateError' do
        expect {
          subject.perform(rule.id)
        }.to raise_error(FirewallRule::InvalidStateError, /Cannot unblock rule that is not blocked/)
      end
      
      it 'does not call Cloudflare API' do
        expect(firewall_service).not_to receive(:delete_rule)
        expect { subject.perform(rule.id) }.to raise_error(FirewallRule::InvalidStateError)
      end
    end
    
    context 'when rule has no cloudflare_rule_id' do
      let(:rule) { create(:firewall_rule, firewall: firewall, status: 'blocked', cloudflare_rule_id: nil) }
      
      it 'marks as unblocked without API call' do
        expect(firewall_service).not_to receive(:delete_rule)
        
        subject.perform(rule.id)
        
        expect(rule.reload.status).to eq('unblocked')
      end
      
      it 'logs warning about missing ID' do
        expect(Rails.logger).to receive(:warn).with(/No Cloudflare rule ID found/)
        subject.perform(rule.id)
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
    let(:rule) { create(:firewall_rule, firewall: firewall, status: 'unblocking', cloudflare_rule_id: 'cf_123') }
    let(:job) do
      {
        'args' => [rule.id],
        'error_message' => 'Maximum retries exceeded',
        'error_class' => 'Cloudflare::UnblockWorker::UnblockingError'
      }
    end
    
    before do
      allow(Rollbar).to receive(:error)
    end
    
    it 'marks rule as permanently failed' do
      described_class.sidekiq_retries_exhausted_block.call(job)
      
      expect(rule.reload).to have_attributes(
        status: 'failed',
        last_error: 'Maximum retries exceeded after 5 attempts - manual intervention required'
      )
    end
    
    it 'keeps cloudflare_rule_id for manual cleanup' do
      described_class.sidekiq_retries_exhausted_block.call(job)
      expect(rule.reload.cloudflare_rule_id).to eq('cf_123')
    end
    
    it 'logs to Rollbar' do
      expect(Rollbar).to receive(:error).with(
        'Cloudflare unblocking failed after max retries',
        hash_including(
          firewall_rule_id: rule.id,
          domain: rule.domain,
          cloudflare_rule_id: 'cf_123',
          error: 'Maximum retries exceeded'
        )
      )
      
      described_class.sidekiq_retries_exhausted_block.call(job)
    end
    
    it 'notifies admin for manual intervention' do
      allow(AdminMailer).to receive(:unblock_failure_needs_intervention).and_return(double(deliver_later: true))
      
      expect(AdminMailer).to receive(:unblock_failure_needs_intervention).with(rule)
      
      described_class.sidekiq_retries_exhausted_block.call(job)
    end
  end
end

RSpec.describe Cloudflare::UnblockWorker::BatchWorker, type: :worker do
  describe '#perform' do
    let(:user) { create(:user) }
    let(:firewall1) { create(:firewall, user: user, has_blocked_domains: true) }
    let(:firewall2) { create(:firewall, user: user, has_blocked_domains: true) }
    let(:inactive_firewall) { create(:firewall, user: user, has_blocked_domains: false) }
    let(:other_user_firewall) { create(:firewall, has_blocked_domains: true) }
    
    let!(:blocked_rule1) { create(:firewall_rule, firewall: firewall1, status: 'blocked', cloudflare_rule_id: 'cf_1') }
    let!(:blocked_rule2) { create(:firewall_rule, firewall: firewall1, status: 'blocked', cloudflare_rule_id: 'cf_2') }
    let!(:blocked_rule3) { create(:firewall_rule, firewall: firewall2, status: 'blocked', cloudflare_rule_id: 'cf_3') }
    let!(:pending_rule) { create(:firewall_rule, firewall: firewall1, status: 'pending') }
    let!(:unblocked_rule) { create(:firewall_rule, firewall: firewall1, status: 'unblocked') }
    let!(:failed_rule) { create(:firewall_rule, firewall: firewall1, status: 'failed', cloudflare_rule_id: 'cf_4', last_attempted_at: 2.hours.ago) }
    let!(:other_user_rule) { create(:firewall_rule, firewall: other_user_firewall, status: 'blocked') }
    
    before do
      allow(Cloudflare::UnblockWorker).to receive(:perform_async)
    end
    
    context 'when processing monthly unblock for a user' do
      it 'enqueues UnblockWorker for all blocked rules' do
        subject.perform(user.id)
        
        expect(Cloudflare::UnblockWorker).to have_received(:perform_async).with(blocked_rule1.id)
        expect(Cloudflare::UnblockWorker).to have_received(:perform_async).with(blocked_rule2.id)
        expect(Cloudflare::UnblockWorker).to have_received(:perform_async).with(blocked_rule3.id)
      end
      
      it 'enqueues UnblockWorker for retryable failed rules with cloudflare_rule_id' do
        subject.perform(user.id)
        
        expect(Cloudflare::UnblockWorker).to have_received(:perform_async).with(failed_rule.id)
      end
      
      it 'does not enqueue for non-blocked rules' do
        subject.perform(user.id)
        
        expect(Cloudflare::UnblockWorker).not_to have_received(:perform_async).with(pending_rule.id)
        expect(Cloudflare::UnblockWorker).not_to have_received(:perform_async).with(unblocked_rule.id)
      end
      
      it 'does not enqueue rules from other users' do
        subject.perform(user.id)
        
        expect(Cloudflare::UnblockWorker).not_to have_received(:perform_async).with(other_user_rule.id)
      end
      
      it 'updates failed rules status to unblocking' do
        subject.perform(user.id)
        
        expect(failed_rule.reload.status).to eq('unblocking')
      end
      
      it 'returns count of rules processed' do
        count = subject.perform(user.id)
        expect(count).to eq(4) # 3 blocked + 1 retryable failed
      end
      
      it 'logs unblock batch start' do
        expect(Rails.logger).to receive(:info).with(/Starting monthly unblock for user #{user.id}/)
        subject.perform(user.id)
      end
      
      it 'logs unblock batch completion' do
        expect(Rails.logger).to receive(:info).with(/Queued 4 rules for unblocking/)
        subject.perform(user.id)
      end
    end
    
    context 'when user has no blocked rules' do
      let(:user_without_blocks) { create(:user) }
      let!(:firewall) { create(:firewall, user: user_without_blocks, has_blocked_domains: false) }
      
      it 'returns 0' do
        count = subject.perform(user_without_blocks.id)
        expect(count).to eq(0)
      end
      
      it 'does not enqueue any workers' do
        subject.perform(user_without_blocks.id)
        expect(Cloudflare::UnblockWorker).not_to have_received(:perform_async)
      end
    end
    
    context 'when user does not exist' do
      it 'raises ActiveRecord::RecordNotFound' do
        expect {
          subject.perform(999999)
        }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
    
    context 'with rate limiting for large batches' do
      let!(:many_rules) { create_list(:firewall_rule, 100, firewall: firewall1, status: 'blocked', cloudflare_rule_id: 'cf_x') }
      
      it 'processes rules in batches with delays' do
        expect(Cloudflare::UnblockWorker).to receive(:perform_in).at_least(:once)
        subject.perform(user.id)
      end
      
      it 'spaces out jobs over time' do
        delays = []
        allow(Cloudflare::UnblockWorker).to receive(:perform_in) do |delay, rule_id|
          delays << delay
        end
        
        subject.perform(user.id)
        
        # Check that delays increase for each batch
        batch_delays = delays.each_slice(10).map(&:first).compact
        expect(batch_delays).to eq(batch_delays.sort)
      end
    end
    
    context 'when called as monthly scheduled job' do
      it 'processes all users with blocked domains' do
        user2 = create(:user)
        firewall3 = create(:firewall, user: user2, has_blocked_domains: true)
        blocked_rule4 = create(:firewall_rule, firewall: firewall3, status: 'blocked')
        
        # Simulate calling batch worker for all users
        [user, user2].each do |u|
          subject.perform(u.id)
        end
        
        expect(Cloudflare::UnblockWorker).to have_received(:perform_async).exactly(5).times
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
  
  describe 'monthly scheduling' do
    it 'is configured to run on the 1st of each month' do
      # This would be tested in the Sidekiq cron configuration
      # spec/config/sidekiq_cron_spec.rb or similar
      expect(Sidekiq::Cron::Job.find('monthly_unblock')).to have_attributes(
        cron: '0 0 1 * *',
        class: 'Cloudflare::UnblockWorker::MonthlyJob'
      )
    end
  end
end