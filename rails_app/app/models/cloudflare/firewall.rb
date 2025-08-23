# == Schema Information
#
# Table name: cloudflare_firewalls
#
#  id           :integer          not null, primary key
#  user_id      :integer          not null
#  status       :string           default("inactive")
#  blocked_at   :datetime
#  unblocked_at :datetime
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#
# Indexes
#
#  index_cloudflare_firewalls_on_blocked_at    (blocked_at)
#  index_cloudflare_firewalls_on_created_at    (created_at)
#  index_cloudflare_firewalls_on_status        (status)
#  index_cloudflare_firewalls_on_unblocked_at  (unblocked_at)
#  index_cloudflare_firewalls_on_user_id       (user_id)
#

class Cloudflare
  class Firewall < ApplicationRecord
    include Cloudflare::FirewallStatuses
    self.table_name = "cloudflare_firewalls"

    has_many :rules, class_name: "Cloudflare::FirewallRule"
    alias_method :firewall_rules, :rules
    belongs_to :user

    validates_presence_of :user_id, :status
    validates :status, presence: true, inclusion: { in: Cloudflare::FirewallStatuses::STATUS }

    scope :blocked, -> { where(status: 'blocked') }
    scope :inactive, -> { where(status: 'inactive') }

    def self.block_user(user)
      Cloudflare::BlockWorker.perform_async(user_id: user.id)
    end

    def self.actually_block_user(user)
      domains = Domain.where(user: user)
      firewall = user.firewall || user.create_firewall
      existing_firewall_rules = FirewallRule.where(domain_id: domains.pluck(:id))
      firewall_rules_by_domain = existing_firewall_rules.index_by(&:domain_id)
      unblocked_domains = domains.select do |domain|
        firewall_rules_by_domain[domain.id].blank? ||
        firewall_rules_by_domain[domain.id].status == Cloudflare::FirewallStatuses::INACTIVE
      end
      
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
          firewall_rule.user = user
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
        raise "Failed to block domains for user #{user.id}: #{response.errors.join(', ')}"
      end
    end

    def self.unblock_user(user, force: false)
      Cloudflare::UnblockWorker.perform_async(user_id: user.id, force: force)
    end

    def self.actually_unblock_user(user, force: false)
      # Don't allow unblocking if the user is over their monthly request limit
      #
      # BUT if a user changes plans, and thus their monthly request limit changes,
      # we want to allow unblocking
      return if user.over_monthly_request_limit? && !force

      firewall_rules = FirewallRule.where(user: user).blocked
      return unless firewall_rules.any?

      response = Cloudflare::FirewallService.new.unblock_domains(firewall_rules.map(&:cloudflare_rule_id))
      if response.success?
        firewall.update!(status: Cloudflare::FirewallStatuses::INACTIVE, unblocked_at: Time.current)
        firewall_rules.update_all(
          status: Cloudflare::FirewallStatuses::INACTIVE,
          unblocked_at: Time.current,
          blocked_at: nil
        )
      else
        raise "Failed to block domains for user #{user.id}: #{response.errors.join(', ')}"
      end
    end 
  end
end
