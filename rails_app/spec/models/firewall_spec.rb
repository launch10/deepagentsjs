# == Schema Information
#
# Table name: firewalls
#
#  id                  :integer          not null, primary key
#  user_id             :integer          not null
#  zone_id             :string           not null
#  zone_name           :string           not null
#  status              :string           default("active")
#  has_blocked_domains :boolean          default("false")
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#
# Indexes
#
#  index_firewalls_on_has_blocked_domains  (has_blocked_domains)
#  index_firewalls_on_status               (status)
#  index_firewalls_on_user_id              (user_id)
#  index_firewalls_on_zone_id              (zone_id)
#  index_firewalls_on_zone_id_and_user_id  (zone_id,user_id) UNIQUE
#

require 'rails_helper'

RSpec.describe Firewall, type: :model do
  describe 'associations' do
    it { should belong_to(:user) }
    it { should have_many(:firewall_rules).dependent(:destroy) }
  end

  describe 'validations' do
    subject { build(:firewall) }
    
    it { should validate_presence_of(:user) }
    it { should validate_presence_of(:zone_id) }
    it { should validate_presence_of(:zone_name) }
    it { should validate_uniqueness_of(:zone_id).scoped_to(:user_id) }
  end

  describe 'scopes' do
    let(:user) { create(:user) }
    let!(:active_firewall) { create(:firewall, user: user, status: 'active') }
    let!(:inactive_firewall) { create(:firewall, user: user, status: 'inactive') }
    let!(:blocked_firewall) { create(:firewall, user: user, has_blocked_domains: true) }
    let!(:unblocked_firewall) { create(:firewall, user: user, has_blocked_domains: false) }

    describe '.active' do
      it 'returns only active firewalls' do
        expect(Firewall.active).to include(active_firewall)
        expect(Firewall.active).not_to include(inactive_firewall)
      end
    end

    describe '.with_blocked_domains' do
      it 'returns only firewalls with blocked domains' do
        expect(Firewall.with_blocked_domains).to include(blocked_firewall)
        expect(Firewall.with_blocked_domains).not_to include(unblocked_firewall)
      end
    end
  end

  describe '#block_domains' do
    let(:user) { create(:user) }
    let(:firewall) { create(:firewall, user: user) }
    let(:domains_to_block) do
      [
        { domain: 'spam1.example.com', request_count: 1000, first_seen_at: 1.day.ago, last_seen_at: 1.hour.ago },
        { domain: 'spam2.example.com', request_count: 500, first_seen_at: 2.days.ago, last_seen_at: 2.hours.ago }
      ]
    end

    context 'when blocking domains successfully' do
      before do
        allow(Cloudflare::BlockWorker).to receive(:perform_async)
      end

      it 'creates firewall rules for each domain' do
        expect {
          firewall.block_domains(domains_to_block)
        }.to change { firewall.firewall_rules.count }.by(2)
      end

      it 'sets correct attributes on firewall rules' do
        firewall.block_domains(domains_to_block)
        
        rule = firewall.firewall_rules.find_by(domain: 'spam1.example.com')
        expect(rule).to have_attributes(
          domain: 'spam1.example.com',
          request_count: 1000,
          status: 'pending',
          blocked_at: nil,
          first_seen_at: domains_to_block[0][:first_seen_at],
          last_seen_at: domains_to_block[0][:last_seen_at]
        )
      end

      it 'enqueues BlockWorker for each rule' do
        firewall.block_domains(domains_to_block)
        
        firewall.firewall_rules.each do |rule|
          expect(Cloudflare::BlockWorker).to have_received(:perform_async).with(rule.id)
        end
      end

      it 'updates has_blocked_domains flag' do
        expect {
          firewall.block_domains(domains_to_block)
        }.to change { firewall.has_blocked_domains }.from(false).to(true)
      end

      it 'does not create duplicate rules for existing domains' do
        existing_rule = create(:firewall_rule, firewall: firewall, domain: 'spam1.example.com', status: 'blocked')
        
        expect {
          firewall.block_domains(domains_to_block)
        }.to change { firewall.firewall_rules.count }.by(1)
      end
    end

    context 'when handling errors' do
      it 'rolls back transaction on failure' do
        allow(FirewallRule).to receive(:create!).and_raise(ActiveRecord::RecordInvalid)
        
        expect {
          expect {
            firewall.block_domains(domains_to_block)
          }.to raise_error(ActiveRecord::RecordInvalid)
        }.not_to change { firewall.firewall_rules.count }
      end
    end
  end

  describe '#unblock_all' do
    let(:user) { create(:user) }
    let(:firewall) { create(:firewall, user: user, has_blocked_domains: true) }
    let!(:blocked_rule1) { create(:firewall_rule, firewall: firewall, status: 'blocked') }
    let!(:blocked_rule2) { create(:firewall_rule, firewall: firewall, status: 'blocked') }
    let!(:pending_rule) { create(:firewall_rule, firewall: firewall, status: 'pending') }
    let!(:failed_rule) { create(:firewall_rule, firewall: firewall, status: 'failed') }

    before do
      allow(Cloudflare::UnblockWorker).to receive(:perform_async)
    end

    it 'enqueues unblock worker for each blocked rule' do
      firewall.unblock_all
      
      expect(Cloudflare::UnblockWorker).to have_received(:perform_async).with(blocked_rule1.id)
      expect(Cloudflare::UnblockWorker).to have_received(:perform_async).with(blocked_rule2.id)
    end

    it 'does not enqueue unblock for non-blocked rules' do
      firewall.unblock_all
      
      expect(Cloudflare::UnblockWorker).not_to have_received(:perform_async).with(pending_rule.id)
      expect(Cloudflare::UnblockWorker).not_to have_received(:perform_async).with(failed_rule.id)
    end

    it 'updates has_blocked_domains flag when no blocked rules remain' do
      allow(firewall.firewall_rules).to receive(:blocked).and_return(FirewallRule.none)
      
      expect {
        firewall.unblock_all
      }.to change { firewall.has_blocked_domains }.from(true).to(false)
    end

    it 'returns count of rules being unblocked' do
      count = firewall.unblock_all
      expect(count).to eq(2)
    end
  end

  describe '#sync_with_cloudflare' do
    let(:user) { create(:user) }
    let(:firewall) { create(:firewall, user: user) }
    let(:cloudflare_rules) do
      [
        { id: 'cf_rule_1', expression: 'http.host eq "spam1.example.com"', action: 'block' },
        { id: 'cf_rule_2', expression: 'http.host eq "spam2.example.com"', action: 'block' }
      ]
    end

    before do
      allow_any_instance_of(Cloudflare::FirewallService).to receive(:list_rules).and_return(cloudflare_rules)
    end

    it 'creates local rules for cloudflare rules not in database' do
      expect {
        firewall.sync_with_cloudflare
      }.to change { firewall.firewall_rules.count }.by(2)
    end

    it 'marks orphaned local rules as removed' do
      orphaned_rule = create(:firewall_rule, firewall: firewall, cloudflare_rule_id: 'cf_rule_999', status: 'blocked')
      
      firewall.sync_with_cloudflare
      
      expect(orphaned_rule.reload.status).to eq('removed')
    end

    it 'updates cloudflare_rule_id for matching domains' do
      existing_rule = create(:firewall_rule, firewall: firewall, domain: 'spam1.example.com', cloudflare_rule_id: nil)
      
      firewall.sync_with_cloudflare
      
      expect(existing_rule.reload.cloudflare_rule_id).to eq('cf_rule_1')
    end
  end

  describe '.monthly_unblock_all' do
    let(:user1) { create(:user) }
    let(:user2) { create(:user) }
    let!(:firewall1) { create(:firewall, user: user1, has_blocked_domains: true) }
    let!(:firewall2) { create(:firewall, user: user2, has_blocked_domains: true) }
    let!(:firewall3) { create(:firewall, user: user1, has_blocked_domains: false) }

    before do
      allow(Cloudflare::UnblockWorker::BatchWorker).to receive(:perform_async)
    end

    it 'enqueues batch unblock worker for each user with blocked domains' do
      Firewall.monthly_unblock_all
      
      expect(Cloudflare::UnblockWorker::BatchWorker).to have_received(:perform_async).with(user1.id)
      expect(Cloudflare::UnblockWorker::BatchWorker).to have_received(:perform_async).with(user2.id)
    end

    it 'returns count of users processed' do
      count = Firewall.monthly_unblock_all
      expect(count).to eq(2)
    end
  end
end
