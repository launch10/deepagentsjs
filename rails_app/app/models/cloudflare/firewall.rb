# == Schema Information
#
# Table name: cloudflare_firewalls
#
#  id         :integer          not null, primary key
#  user_id    :integer
#  status     :string
#  blocked_at :datetime
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_cloudflare_firewalls_on_blocked_at  (blocked_at)
#  index_cloudflare_firewalls_on_created_at  (created_at)
#  index_cloudflare_firewalls_on_status      (status)
#  index_cloudflare_firewalls_on_user_id     (user_id)
#

class Cloudflare
  class Firewall < ApplicationRecord
    include Cloudflare::FirewallStatuses
    self.table_name = "cloudflare_firewalls"

    has_many :rules, class_name: "Cloudflare::FirewallRule"
    belongs_to :user

    validates_presence_of :user_id, :status
    validates :status, presence: true, inclusion: { in: Cloudflare::FirewallStatuses::STATUS }

    scope :blocked, -> { where(status: 'blocked') }
    scope :inactive, -> { where(status: 'inactive') }

    def self.block_domains(user)
      domains = Domain.where(user: user)
      domain_names = domains.pluck(:domain)
      firewall = user.firewall
      existing_firewall_rules = FirewallRule.where(domain: domain_names)
      firewall_rules_by_domain = existing_firewall_rules.index_by(&:domain)
      unblocked_domains = domains.select do |domain|
        firewall_rules_by_domain[domain.domain].blank? ||
        firewall_rules_by_domain[domain.domain].status == Cloudflare::FirewallStatuses::INACTIVE
      end
      
      to_insert = unblocked_domains.map do |domain|
        firewall_rule = Cloudflare::FirewallRule.find_or_initialize_by(
          domain_id: domain.id,
        )
        firewall_rule.status = Cloudflare::FirewallStatuses::INACTIVE
        firewall_rule.user = user
        firewall_rule.firewall = firewall
        firewall_rule
      end

      Cloudflare::FirewallRule.import(to_insert, 
        on_duplicate_key_update: { 
          conflict_target: [:domain_id], 
          columns: [:status] 
        }
      )
      Cloudflare::BlockWorker.perform_async(user_id: user.id)
    end

    def self.unblock_domains(user)
      
    end
  end
end
