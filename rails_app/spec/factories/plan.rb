require 'faker'

FactoryBot.define do
  factory :plan do
    name { 'default' }
    interval { 'month' }
    amount { 1900 }
    stripe_id { 'personal' }
    details { {features: ['Unlimited access']} }

    trait :starter do
      name { 'starter' }
      amount { 900 }
    end

    trait :pro do
      name { 'pro' }
      amount { 1900 }
    end

    trait :enterprise do
      name { 'enterprise' }
      amount { 9900 }
    end
  end
end
