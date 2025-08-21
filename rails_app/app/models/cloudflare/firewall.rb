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

module Cloudflare
  class Firewall < ApplicationRecord
    include Cloudflare::Statuses
    self.table_name = "cloudflare_firewalls"

    has_many :rules, class_name: "Cloudflare::FirewallRule"
    belongs_to :user

    validates_presence_of :user_id, :status
    validates :status, presence: true, inclusion: { in: Cloudflare::Statuses::STATUS }
  end
end
