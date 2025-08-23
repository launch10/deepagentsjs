# == Schema Information
#
# Table name: firewall_rules
#
#  id                 :integer          not null, primary key
#  firewall_id        :integer          not null
#  domain             :string           not null
#  status             :string           default("pending"), not null
#  cloudflare_rule_id :string
#  request_count      :integer          default("0")
#  first_seen_at      :datetime
#  last_seen_at       :datetime
#  blocked_at         :datetime
#  unblocked_at       :datetime
#  last_attempted_at  :datetime
#  reason             :text
#  last_error         :text
#  error_count        :integer          default("0")
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#
# Indexes
#
#  index_firewall_rules_on_blocked_at               (blocked_at)
#  index_firewall_rules_on_cloudflare_rule_id       (cloudflare_rule_id)
#  index_firewall_rules_on_domain                   (domain)
#  index_firewall_rules_on_error_count              (error_count)
#  index_firewall_rules_on_firewall_id              (firewall_id)
#  index_firewall_rules_on_firewall_id_and_domain   (firewall_id,domain) UNIQUE
#  index_firewall_rules_on_status                   (status)
#  index_firewall_rules_on_status_and_last_attempt  (status,last_attempted_at)
#  index_firewall_rules_on_unblocked_at             (unblocked_at)
#

require 'rails_helper'

RSpec.describe FirewallRule, type: :model do
  describe 'associations' do
    it { should belong_to(:firewall) }
    it { should have_one(:user).through(:firewall) }
  end

  describe 'validations' do
    it { should validate_presence_of(:firewall) }
    it { should validate_presence_of(:domain) }
    it { should validate_presence_of(:status) }
    
    it { should validate_inclusion_of(:status).in_array(%w[pending blocking blocked unblocking unblocked failed removed]) }
    
    describe 'domain uniqueness' do
      let(:firewall) { create(:firewall) }
      let!(:existing_rule) { create(:firewall_rule, firewall: firewall, domain: 'spam.example.com') }
      
      it 'validates uniqueness of domain scoped to firewall' do
        duplicate_rule = build(:firewall_rule, firewall: firewall, domain: 'spam.example.com')
        expect(duplicate_rule).not_to be_valid
        expect(duplicate_rule.errors[:domain]).to include('has already been taken')
      end
      
      it 'allows same domain in different firewall' do
        other_firewall = create(:firewall)
        rule = build(:firewall_rule, firewall: other_firewall, domain: 'spam.example.com')
        expect(rule).to be_valid
      end
    end
  end

  describe 'scopes' do
    let(:firewall) { create(:firewall) }
    let!(:pending_rule) { create(:firewall_rule, firewall: firewall, status: 'pending') }
    let!(:blocking_rule) { create(:firewall_rule, firewall: firewall, status: 'blocking') }
    let!(:blocked_rule) { create(:firewall_rule, firewall: firewall, status: 'blocked') }
    let!(:unblocking_rule) { create(:firewall_rule, firewall: firewall, status: 'unblocking') }
    let!(:unblocked_rule) { create(:firewall_rule, firewall: firewall, status: 'unblocked') }
    let!(:failed_rule) { create(:firewall_rule, firewall: firewall, status: 'failed') }
    let!(:removed_rule) { create(:firewall_rule, firewall: firewall, status: 'removed') }

    describe '.pending' do
      it 'returns only pending rules' do
        expect(FirewallRule.pending).to contain_exactly(pending_rule)
      end
    end

    describe '.blocking' do
      it 'returns only rules being blocked' do
        expect(FirewallRule.blocking).to contain_exactly(blocking_rule)
      end
    end

    describe '.blocked' do
      it 'returns only blocked rules' do
        expect(FirewallRule.blocked).to contain_exactly(blocked_rule)
      end
    end

    describe '.unblocking' do
      it 'returns only rules being unblocked' do
        expect(FirewallRule.unblocking).to contain_exactly(unblocking_rule)
      end
    end

    describe '.unblocked' do
      it 'returns only unblocked rules' do
        expect(FirewallRule.unblocked).to contain_exactly(unblocked_rule)
      end
    end

    describe '.failed' do
      it 'returns only failed rules' do
        expect(FirewallRule.failed).to contain_exactly(failed_rule)
      end
    end

    describe '.active' do
      it 'returns blocked and blocking rules' do
        expect(FirewallRule.active).to contain_exactly(blocking_rule, blocked_rule)
      end
    end

    describe '.needs_retry' do
      let!(:recent_failed) { create(:firewall_rule, firewall: firewall, status: 'failed', last_attempted_at: 5.minutes.ago) }
      let!(:old_failed) { create(:firewall_rule, firewall: firewall, status: 'failed', last_attempted_at: 2.hours.ago) }
      let!(:never_attempted) { create(:firewall_rule, firewall: firewall, status: 'failed', last_attempted_at: nil) }
      
      it 'returns failed rules that should be retried' do
        expect(FirewallRule.needs_retry).to contain_exactly(old_failed, never_attempted)
      end
    end
  end

  describe '#block!' do
    let(:rule) { create(:firewall_rule, status: 'pending') }
    let(:cloudflare_rule_id) { 'cf_rule_123' }
    
    context 'when blocking succeeds' do
      it 'updates status to blocked' do
        expect {
          rule.block!(cloudflare_rule_id)
        }.to change { rule.status }.from('pending').to('blocked')
      end
      
      it 'sets cloudflare_rule_id' do
        rule.block!(cloudflare_rule_id)
        expect(rule.cloudflare_rule_id).to eq(cloudflare_rule_id)
      end
      
      it 'sets blocked_at timestamp' do
        Timecop.freeze do
          rule.block!(cloudflare_rule_id)
          expect(rule.blocked_at).to eq(Time.current)
        end
      end
      
      it 'clears error fields' do
        rule.update(last_error: 'Previous error', error_count: 2)
        rule.block!(cloudflare_rule_id)
        
        expect(rule.last_error).to be_nil
        expect(rule.error_count).to eq(0)
      end
    end
    
    context 'when already blocked' do
      let(:rule) { create(:firewall_rule, status: 'blocked', cloudflare_rule_id: 'existing_id') }
      
      it 'does not change cloudflare_rule_id' do
        expect {
          rule.block!(cloudflare_rule_id)
        }.not_to change { rule.cloudflare_rule_id }
      end
    end
  end

  describe '#unblock!' do
    let(:rule) { create(:firewall_rule, status: 'blocked', cloudflare_rule_id: 'cf_rule_123', blocked_at: 1.day.ago) }
    
    context 'when unblocking succeeds' do
      it 'updates status to unblocked' do
        expect {
          rule.unblock!
        }.to change { rule.status }.from('blocked').to('unblocked')
      end
      
      it 'clears cloudflare_rule_id' do
        rule.unblock!
        expect(rule.cloudflare_rule_id).to be_nil
      end
      
      it 'sets unblocked_at timestamp' do
        Timecop.freeze do
          rule.unblock!
          expect(rule.unblocked_at).to eq(Time.current)
        end
      end
      
      it 'preserves blocked_at timestamp' do
        original_blocked_at = rule.blocked_at
        rule.unblock!
        expect(rule.blocked_at).to eq(original_blocked_at)
      end
    end
    
    context 'when not blocked' do
      let(:rule) { create(:firewall_rule, status: 'pending') }
      
      it 'raises an error' do
        expect {
          rule.unblock!
        }.to raise_error(FirewallRule::InvalidStateError, /Cannot unblock rule that is not blocked/)
      end
    end
  end

  describe '#mark_failed!' do
    let(:rule) { create(:firewall_rule, status: 'blocking') }
    let(:error_message) { 'API rate limit exceeded' }
    
    it 'updates status to failed' do
      expect {
        rule.mark_failed!(error_message)
      }.to change { rule.status }.to('failed')
    end
    
    it 'sets last_error' do
      rule.mark_failed!(error_message)
      expect(rule.last_error).to eq(error_message)
    end
    
    it 'increments error_count' do
      expect {
        rule.mark_failed!(error_message)
      }.to change { rule.error_count }.from(0).to(1)
    end
    
    it 'sets last_attempted_at' do
      Timecop.freeze do
        rule.mark_failed!(error_message)
        expect(rule.last_attempted_at).to eq(Time.current)
      end
    end
    
    it 'accumulates error count on multiple failures' do
      rule.mark_failed!('First error')
      rule.update(status: 'blocking')
      rule.mark_failed!('Second error')
      
      expect(rule.error_count).to eq(2)
      expect(rule.last_error).to eq('Second error')
    end
  end

  describe '#retry!' do
    let(:rule) { create(:firewall_rule, status: 'failed', error_count: 3, last_error: 'Previous error') }
    
    context 'when retrying a block operation' do
      before do
        allow(Cloudflare::BlockWorker).to receive(:perform_async)
      end
      
      it 'updates status to blocking' do
        expect {
          rule.retry!(:block)
        }.to change { rule.status }.from('failed').to('blocking')
      end
      
      it 'enqueues BlockWorker' do
        rule.retry!(:block)
        expect(Cloudflare::BlockWorker).to have_received(:perform_async).with(rule.id)
      end
      
      it 'does not clear error count immediately' do
        rule.retry!(:block)
        expect(rule.error_count).to eq(3)
      end
    end
    
    context 'when retrying an unblock operation' do
      let(:rule) { create(:firewall_rule, status: 'failed', cloudflare_rule_id: 'cf_123') }
      
      before do
        allow(Cloudflare::UnblockWorker).to receive(:perform_async)
      end
      
      it 'updates status to unblocking' do
        expect {
          rule.retry!(:unblock)
        }.to change { rule.status }.from('failed').to('unblocking')
      end
      
      it 'enqueues UnblockWorker' do
        rule.retry!(:unblock)
        expect(Cloudflare::UnblockWorker).to have_received(:perform_async).with(rule.id)
      end
    end
    
    context 'with invalid operation' do
      it 'raises an error' do
        expect {
          rule.retry!(:invalid)
        }.to raise_error(ArgumentError, /Invalid operation/)
      end
    end
    
    context 'when rule is not in failed state' do
      let(:rule) { create(:firewall_rule, status: 'blocked') }
      
      it 'raises an error' do
        expect {
          rule.retry!(:block)
        }.to raise_error(FirewallRule::InvalidStateError, /Can only retry failed rules/)
      end
    end
  end

  describe '#can_retry?' do
    let(:rule) { create(:firewall_rule, status: 'failed') }
    
    context 'when last attempt was recent' do
      before { rule.update(last_attempted_at: 5.minutes.ago) }
      
      it 'returns false' do
        expect(rule.can_retry?).to be false
      end
    end
    
    context 'when last attempt was long ago' do
      before { rule.update(last_attempted_at: 2.hours.ago) }
      
      it 'returns true' do
        expect(rule.can_retry?).to be true
      end
    end
    
    context 'when never attempted' do
      before { rule.update(last_attempted_at: nil) }
      
      it 'returns true' do
        expect(rule.can_retry?).to be true
      end
    end
    
    context 'when not in failed state' do
      let(:rule) { create(:firewall_rule, status: 'blocked') }
      
      it 'returns false' do
        expect(rule.can_retry?).to be false
      end
    end
    
    context 'when max retries exceeded' do
      before { rule.update(error_count: 10, last_attempted_at: 2.hours.ago) }
      
      it 'returns false' do
        expect(rule.can_retry?).to be false
      end
    end
  end

  describe '#build_cloudflare_expression' do
    let(:rule) { build(:firewall_rule, domain: 'spam.example.com') }
    
    it 'returns proper Cloudflare WAF expression' do
      expect(rule.build_cloudflare_expression).to eq('(http.host eq "spam.example.com")')
    end
    
    it 'escapes special characters in domain' do
      rule.domain = 'spam"test.example.com'
      expect(rule.build_cloudflare_expression).to eq('(http.host eq "spam\"test.example.com")')
    end
  end

  describe 'callbacks' do
    describe 'after_update' do
      let(:firewall) { create(:firewall, has_blocked_domains: false) }
      let(:rule) { create(:firewall_rule, firewall: firewall, status: 'pending') }
      
      context 'when rule becomes blocked' do
        it 'updates firewall has_blocked_domains flag' do
          expect {
            rule.update(status: 'blocked')
          }.to change { firewall.reload.has_blocked_domains }.from(false).to(true)
        end
      end
      
      context 'when last blocked rule is unblocked' do
        let(:firewall) { create(:firewall, has_blocked_domains: true) }
        let!(:rule) { create(:firewall_rule, firewall: firewall, status: 'blocked') }
        
        it 'updates firewall has_blocked_domains flag' do
          expect {
            rule.update(status: 'unblocked')
          }.to change { firewall.reload.has_blocked_domains }.from(true).to(false)
        end
      end
    end
  end
end
