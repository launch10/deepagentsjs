FactoryBot.define do
  factory :ad_group do
    association :campaign

    sequence(:name) { |n| "Ad Group #{n}" }
  end
end
