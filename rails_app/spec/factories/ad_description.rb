FactoryBot.define do
  factory :ad_description do
    association :ad
    position { (ad.descriptions.maximum(:position) || -1) + 1 }
    sequence(:text) { |n| "Ad Description #{n}" }
  end
end
