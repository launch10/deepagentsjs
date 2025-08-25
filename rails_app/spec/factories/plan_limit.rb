require 'faker'

FactoryBot.define do
  factory :plan_limit do
    limit_type { "requests_per_month" }

    trait :starter_limit do
      limit { 1_000_000 }
    end

    trait :pro_limit do
      limit { 5_000_000 }
    end

    trait :enterprise_limit do
      limit { 20_000_000 }
    end
  end
end
