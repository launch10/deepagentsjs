# == Schema Information
#
# Table name: cloudflare_firewall_rules
#
#  id                 :integer          not null, primary key
#  firewall_id        :integer          not null
#  domain_id          :integer          not null
#  user_id            :integer          not null
#  status             :string           default("inactive"), not null
#  cloudflare_rule_id :string           not null
#  blocked_at         :datetime
#  unblocked_at       :datetime
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#
# Indexes
#
#  index_cloudflare_firewall_rules_on_blocked_at          (blocked_at)
#  index_cloudflare_firewall_rules_on_cloudflare_rule_id  (cloudflare_rule_id) UNIQUE
#  index_cloudflare_firewall_rules_on_created_at          (created_at)
#  index_cloudflare_firewall_rules_on_domain_id           (domain_id) UNIQUE
#  index_cloudflare_firewall_rules_on_firewall_id         (firewall_id)
#  index_cloudflare_firewall_rules_on_status              (status)
#  index_cloudflare_firewall_rules_on_unblocked_at        (unblocked_at)
#  index_cloudflare_firewall_rules_on_user_id             (user_id)
#

class Cloudflare
  class FirewallRule < ApplicationRecord
    self.table_name = "cloudflare_firewall_rules"

    belongs_to :firewall
    belongs_to :user

    include Cloudflare::FirewallStatuses

    validates_presence_of :user_id, :firewall_id, :status
    validates :status, presence: true, inclusion: { in: Cloudflare::FirewallStatuses::STATUS }

    scope :inactive, -> { where(status: Cloudflare::FirewallStatuses::INACTIVE) }
    scope :blocked, -> { where(status: Cloudflare::FirewallStatuses::BLOCKED) }
  end
end
