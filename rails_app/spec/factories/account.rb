require 'faker'

FactoryBot.define do
  factory :account do
    sequence(:name) { |n| "Account #{n}" }
    association :owner, factory: :user

    trait :with_google_account do
      after(:create) do |account|
        create(:connected_account, :google, owner: account.owner, auth: {
          "info" => {
            "email" => account.owner.email,
            "name" => account.owner.name
          }
        })
      end
    end
  end
end
