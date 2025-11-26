FactoryBot.define do
  factory :ad_headline do
    association :ad
    position { (ad.headlines.maximum(:position) || 0) + 1 }
    sequence(:text) { |n| "Ad Headline #{n}" }
  end
end
