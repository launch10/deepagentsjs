require 'faker'

FactoryBot.define do
  factory :user do
    email { Faker::Internet.email }
    first_name { Faker::Name.first_name }
    last_name { Faker::Name.last_name }
    password { 'A1a$aXee' }
    password_confirmation { 'A1a$aXee' }
    accepted_terms_at { Time.current }
    accepted_privacy_at { Time.current }
    time_zone { 'Central Time (US & Canada)' }
    confirmed_at { Time.current }

    trait :admin do
      admin { true }
    end

    factory :admin_user, traits: [:admin]
  end
end
