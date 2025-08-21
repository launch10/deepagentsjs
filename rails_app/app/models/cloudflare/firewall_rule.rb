# == Schema Information
#
# Table name: cloudflare_firewall_rules
#
#  id            :integer          not null, primary key
#  firewall_id   :integer
#  user_id       :integer
#  status        :string
#  cloudflare_id :string
#  blocked_at    :datetime
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#
# Indexes
#
#  index_cloudflare_firewall_rules_on_blocked_at          (blocked_at)
#  index_cloudflare_firewall_rules_on_cloudflare_id       (cloudflare_id)
#  index_cloudflare_firewall_rules_on_created_at          (created_at)
#  index_cloudflare_firewall_rules_on_firewall_id         (firewall_id)
#  index_cloudflare_firewall_rules_on_status              (status)
#  index_cloudflare_firewall_rules_on_user_id             (user_id)
#  index_cloudflare_firewall_rules_on_user_id_and_status  (user_id,status)
#

module Cloudflare
  class FirewallRule < ApplicationRecord
    self.table_name = "cloudflare_firewall_rules"

    belongs_to :firewall
    belongs_to :user

    include Cloudflare::Statuses

    validates_presence_of :user_id, :firewall_id, :status
    validates :status, presence: true, inclusion: { in: Cloudflare::Statuses::STATUSES }
  end
end