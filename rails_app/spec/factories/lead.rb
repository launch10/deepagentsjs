require 'faker'

FactoryBot.define do
  factory :lead do
    association :account
    sequence(:email) { |n| "lead#{n}@example.com" }
    name { Faker::Name.name }
    phone { Faker::PhoneNumber.phone_number }

    trait :without_name do
      name { nil }
    end

    trait :without_phone do
      phone { nil }
    end

    trait :with_custom_email do
      transient do
        custom_email { "custom@example.com" }
      end
      email { custom_email }
    end

    # Convenience trait to create a lead with a website_lead
    trait :with_website_lead do
      transient do
        website { nil }
      end

      after(:create) do |lead, evaluator|
        if evaluator.website
          create(:website_lead, lead: lead, website: evaluator.website)
        end
      end
    end
  end
end
