require "faker"

FactoryBot.define do
  factory :plan do
    sequence(:name) { |n| "plan_#{n}" }
    interval { "month" }
    amount { 1900 }
    stripe_id { "price_test" }
    association :plan_tier

    # Starter tier plans ($79/month, $59/month billed annually)
    trait :starter_monthly do
      name { "starter_monthly" }
      amount { 7900 }
      interval { "month" }
      association :plan_tier, :starter
    end

    trait :starter_annual do
      name { "starter_annual" }
      amount { 70800 }
      interval { "year" }
      association :plan_tier, :starter
    end

    # Growth tier plans ($149/month, $119/month billed annually)
    trait :growth_monthly do
      name { "growth_monthly" }
      amount { 14900 }
      interval { "month" }
      association :plan_tier, :growth
    end

    trait :growth_annual do
      name { "growth_annual" }
      amount { 142800 }
      interval { "year" }
      association :plan_tier, :growth
    end

    # Pro tier plans ($399/month, $299/month billed annually)
    trait :pro_monthly do
      name { "pro_monthly" }
      amount { 39900 }
      interval { "month" }
      association :plan_tier, :pro
    end

    trait :pro_annual do
      name { "pro_annual" }
      amount { 358800 }
      interval { "year" }
      association :plan_tier, :pro
    end

    trait :friends_family do
      name { "friends_family" }
      amount { 0 }
      interval { "month" }
      hidden { true }
      fake_processor_id { "friends_family" }
      stripe_id { nil }
      association :plan_tier, :friends_family
    end
  end
end
