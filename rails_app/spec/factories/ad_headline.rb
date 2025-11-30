FactoryBot.define do
  factory :ad_headline do
    association :ad
    position { (ad.headlines.maximum(:position) || -1) + 1 }
    sequence(:text) { |n| "Ad Headline #{n}" }
  end
end
