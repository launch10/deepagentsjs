require "faker"

FactoryBot.define do
  factory :plan do
    sequence(:name) { |n| "plan_#{n}" }
    interval { "month" }
    amount { 1900 }
    stripe_id { "price_test" }
    association :plan_tier

    trait :starter do
      name { "starter" }
      amount { 4900 }
      association :plan_tier, :starter
    end

    trait :starter_monthly do
      name { "starter_monthly" }
      amount { 4900 }
      interval { "month" }
      association :plan_tier, :starter
    end

    trait :starter_annual do
      name { "starter_annual" }
      amount { 47000 }
      interval { "year" }
      association :plan_tier, :starter
    end

    trait :pro do
      name { "pro" }
      amount { 9900 }
      association :plan_tier, :growth
    end

    trait :pro_monthly do
      name { "pro_monthly" }
      amount { 9900 }
      interval { "month" }
      association :plan_tier, :growth
    end

    trait :pro_annual do
      name { "pro_annual" }
      amount { 95000 }
      interval { "year" }
      association :plan_tier, :growth
    end

    trait :enterprise do
      name { "enterprise" }
      amount { 24900 }
      association :plan_tier, :pro
    end

    trait :enterprise_monthly do
      name { "enterprise_monthly" }
      amount { 24900 }
      interval { "month" }
      association :plan_tier, :pro
    end

    trait :enterprise_annual do
      name { "enterprise_annual" }
      amount { 239000 }
      interval { "year" }
      association :plan_tier, :pro
    end
  end
end
