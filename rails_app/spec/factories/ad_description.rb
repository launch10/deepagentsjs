FactoryBot.define do
  factory :ad_description do
    association :ad
    position { (ad.descriptions.maximum(:position) || 0) + 1 }
    sequence(:text) { |n| "Ad Description #{n}" }
  end
end
