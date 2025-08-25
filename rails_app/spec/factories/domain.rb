FactoryBot.define do
  factory :domain do
    association :website
    association :account
    sequence(:domain) { |n| "test-domain-#{n}.abeverything.com" }
    cloudflare_zone_id { nil }

    trait :with_cloudflare do
      cloudflare_zone_id { "cf_zone_#{SecureRandom.hex(8)}" }
    end

    trait :custom_domain do
      sequence(:domain) { |n| "custom-domain-#{n}.com" }
    end
  end
end