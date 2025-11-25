FactoryBot.define do
  factory :ad_keyword do
    association :ad_group
    position { (ad_group.keywords.maximum(:position) || 0) + 1 }
    sequence(:text) { |n| "Ad Keyword #{n}" }
    match_type { "broad" }
  end
end
