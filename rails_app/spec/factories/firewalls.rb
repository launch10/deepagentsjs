FactoryBot.define do
  factory :firewall do
    association :account
    zone_id { "zone_#{SecureRandom.hex(8)}" }
    zone_name { "example-#{SecureRandom.hex(4)}.com" }
    status { 'active' }
    has_blocked_domains { false }
  end
end