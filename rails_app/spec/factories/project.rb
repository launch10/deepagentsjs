require 'faker'

FactoryBot.define do
  factory :project do
    sequence(:name) { |n| "Project #{n}" }
    thread_id { SecureRandom.uuid }
    association :account
  end
end