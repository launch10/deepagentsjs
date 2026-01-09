require 'faker'

FactoryBot.define do
  factory :lead do
    association :project
    sequence(:email) { |n| "lead#{n}@example.com" }
    name { Faker::Name.name }

    trait :without_name do
      name { nil }
    end

    trait :with_custom_email do
      transient do
        custom_email { "custom@example.com" }
      end
      email { custom_email }
    end
  end
end
