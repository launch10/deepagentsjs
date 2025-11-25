FactoryBot.define do
  factory :campaign do
    association :account
    association :project
    association :website

    sequence(:name) { |n| "Campaign #{n}" }
    status { "draft" }
  end
end
