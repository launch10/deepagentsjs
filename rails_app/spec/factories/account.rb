require 'faker'

FactoryBot.define do
  factory :account do
    sequence(:name) { |n| "Account #{n}" }
    association :owner, factory: :user
  end
end