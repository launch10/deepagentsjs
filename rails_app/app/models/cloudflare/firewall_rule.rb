# == Schema Information
#
# Table name: cloudflare_firewall_rules
#
#  id                 :bigint           not null, primary key
#  blocked_at         :datetime
#  status             :string           default("inactive"), not null
#  unblocked_at       :datetime
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint           not null
#  cloudflare_rule_id :string           not null
#  domain_id          :bigint           not null
#  firewall_id        :bigint           not null
#
# Indexes
#
#  index_cloudflare_firewall_rules_on_account_id          (account_id)
#  index_cloudflare_firewall_rules_on_blocked_at          (blocked_at)
#  index_cloudflare_firewall_rules_on_cloudflare_rule_id  (cloudflare_rule_id) UNIQUE
#  index_cloudflare_firewall_rules_on_created_at          (created_at)
#  index_cloudflare_firewall_rules_on_domain_id           (domain_id) UNIQUE
#  index_cloudflare_firewall_rules_on_firewall_id         (firewall_id)
#  index_cloudflare_firewall_rules_on_status              (status)
#  index_cloudflare_firewall_rules_on_unblocked_at        (unblocked_at)
#

class Cloudflare
  class FirewallRule < ApplicationRecord
    self.table_name = "cloudflare_firewall_rules"

    belongs_to :firewall
    belongs_to :account

    include Cloudflare::FirewallStatuses

    validates_presence_of :account_id, :firewall_id, :status
    validates :status, presence: true, inclusion: {in: Cloudflare::FirewallStatuses::STATUS}

    scope :inactive, -> { where(status: Cloudflare::FirewallStatuses::INACTIVE) }
    scope :blocked, -> { where(status: Cloudflare::FirewallStatuses::BLOCKED) }
  end
end
