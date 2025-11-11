require 'faker'

FactoryBot.define do
  factory :project do
    sequence(:name) { |n| "Project #{n}" }
    association :account
  end
end