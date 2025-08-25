# == Schema Information
#
# Table name: cloudflare_firewalls
#
#  id           :integer          not null, primary key
#  account_id   :integer          not null
#  status       :string           default("inactive")
#  blocked_at   :datetime
#  unblocked_at :datetime
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#
# Indexes
#
#  index_cloudflare_firewalls_on_account_id    (account_id)
#  index_cloudflare_firewalls_on_blocked_at    (blocked_at)
#  index_cloudflare_firewalls_on_created_at    (created_at)
#  index_cloudflare_firewalls_on_status        (status)
#  index_cloudflare_firewalls_on_unblocked_at  (unblocked_at)
#

class Cloudflare
  class Firewall < ApplicationRecord
    include Cloudflare::FirewallStatuses
    self.table_name = "cloudflare_firewalls"

    has_many :rules, class_name: "Cloudflare::FirewallRule"
    alias_method :firewall_rules, :rules
    belongs_to :account, class_name: "Account", inverse_of: :firewall

    validates_presence_of :account_id, :status
    validates :status, presence: true, inclusion: { in: Cloudflare::FirewallStatuses::STATUS }

    scope :blocked, -> { where(status: 'blocked') }
    scope :inactive, -> { where(status: 'inactive') }

    def already_blocked?
      blocked? && account.domains.all?(&:blocked?)
    end

    def already_unblocked?
      !blocked? && account.domains.none?(&:blocked?)
    end

    def should_block?
      return false if already_blocked?
      return account.over_monthly_request_limit?
    end

    def should_unblock?
      return false if already_unblocked?
      return account.under_monthly_request_limit?
    end

    def self.block_account(account)
      account.firewall ||= account.build_firewall
      return unless account.firewall.should_block?

      Cloudflare::BlockWorker.perform_async(account_id: account.id)
    end

    def self.actually_block_account(account)
      account.firewall ||= account.build_firewall
      return unless account.firewall.should_block?

      domains = Domain.where(account: account)
      existing_firewall_rules = FirewallRule.where(domain_id: domains.pluck(:id))
      firewall_rules_by_domain = existing_firewall_rules.index_by(&:domain_id)
      unblocked_domains = domains.select do |domain|
        firewall_rules_by_domain[domain.id].blank? ||
        firewall_rules_by_domain[domain.id].status == Cloudflare::FirewallStatuses::INACTIVE
      end
      
      firewall = account.firewall
      firewall_service = Cloudflare::FirewallService.new
      response = firewall_service.block_domains(unblocked_domains)
      if response.success?
        cloudflare_ids_by_domain = firewall_service.search_blocked_domains(unblocked_domains)
        firewall.update!(status: Cloudflare::FirewallStatuses::BLOCKED, blocked_at: Time.current)

        to_insert = unblocked_domains.map do |domain|
          firewall_rule = Cloudflare::FirewallRule.find_or_initialize_by(
            domain_id: domain.id,
          )
          firewall_rule.status = Cloudflare::FirewallStatuses::BLOCKED
          firewall_rule.account = account
          firewall_rule.firewall = firewall
          firewall_rule.cloudflare_rule_id = cloudflare_ids_by_domain[domain.domain]
          firewall_rule.blocked_at = Time.current
          firewall_rule.unblocked_at = nil
          firewall_rule
        end

        Cloudflare::FirewallRule.import(to_insert, 
          on_duplicate_key_update: { 
            conflict_target: [:domain_id], 
            columns: [
              :status,
              :blocked_at,
              :unblocked_at,
              :cloudflare_rule_id,
              :firewall_id
            ] 
          }
        )
      else
        # We raise so that the worker retries, and eventually succeeds
        raise "Failed to block domains for account #{account.id}: #{response.errors.join(', ')}"
      end
    end

    def self.unblock_account(account, force: false)
      account.firewall ||= account.build_firewall
      return unless account.firewall.should_unblock? || force

      Cloudflare::UnblockWorker.perform_async(account_id: account.id, force: force)
    end

    def self.actually_unblock_account(account, force: false)
      account.firewall ||= account.build_firewall
      return unless account.firewall.should_unblock? || force

      firewall_rules = account.firewall.firewall_rules.blocked
      return unless firewall_rules.any?

      response = Cloudflare::FirewallService.new.unblock_domains(firewall_rules.map(&:cloudflare_rule_id))
      if response.success?
        firewall = account.firewall
        firewall.update!(status: Cloudflare::FirewallStatuses::INACTIVE, unblocked_at: Time.current)
        firewall_rules.update_all(
          status: Cloudflare::FirewallStatuses::INACTIVE,
          unblocked_at: Time.current,
          blocked_at: nil
        )
      else
        raise "Failed to block domains for account #{account.id}: #{response.errors.join(', ')}"
      end
    end 
  end
end
