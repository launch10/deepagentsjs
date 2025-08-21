require 'faker'

FactoryBot.define do
  factory :plan do
    interval { 'month' }
    amount { 1900 }
    stripe_id { 'personal' }
    details { { features: ['Unlimited access'] } }

    trait :starter do
      name { 'starter' }
      plan_limits { [build(:plan_limit, :starter_limit)] }
    end

    trait :pro do
      name { 'pro' }
      plan_limits { [build(:plan_limit, :pro_limit)] }
    end

    trait :enterprise do
      name { 'enterprise' }
      plan_limits { [build(:plan_limit, :enterprise_limit)] }
    end
  end
end
