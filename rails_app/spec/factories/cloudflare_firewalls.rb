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

FactoryBot.define do
  factory :cloudflare_firewall, class: 'Cloudflare::Firewall' do
    association :user
    status { 'inactive' }
    cloudflare_zone_id { 'zone_123abc' }
    blocked_at { nil }

    trait :blocked do
      status { 'blocked' }
      blocked_at { Time.current }
    end
  end
end
