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