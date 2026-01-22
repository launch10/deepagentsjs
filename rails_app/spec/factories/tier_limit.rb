FactoryBot.define do
  factory :tier_limit do
    association :tier, factory: :plan_tier
    limit_type { "requests_per_month" }
    limit { 1_000_000 }

    trait :requests_per_month do
      limit_type { "requests_per_month" }
      limit { 1_000_000 }
    end

    trait :platform_subdomains do
      limit_type { "platform_subdomains" }
      limit { 1 }
    end

    trait :starter_requests do
      limit_type { "requests_per_month" }
      limit { 1_000_000 }
    end

    trait :growth_requests do
      limit_type { "requests_per_month" }
      limit { 5_000_000 }
    end

    trait :pro_requests do
      limit_type { "requests_per_month" }
      limit { 20_000_000 }
    end
  end
end
