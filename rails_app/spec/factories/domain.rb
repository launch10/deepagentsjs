FactoryBot.define do
  factory :domain do
    association :website
    association :account
    sequence(:domain) { |n| "test-domain-#{n}.launch10.ai" }
    cloudflare_zone_id { nil }
    is_platform_subdomain { false }

    trait :with_cloudflare do
      cloudflare_zone_id { "cf_zone_#{SecureRandom.hex(8)}" }
    end

    trait :custom_domain do
      sequence(:domain) { |n| "custom-domain-#{n}.com" }
      is_platform_subdomain { false }
    end

    trait :platform_subdomain do
      sequence(:domain) { |n| "site-#{n}.launch10.ai" }
      is_platform_subdomain { true }
    end
  end
end
