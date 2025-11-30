FactoryBot.define do
  factory :ad_callout do
    association :ad_group
    association :campaign
    position { (ad_group.callouts.maximum(:position) || -1) + 1 }
    sequence(:text) { |n| "Ad Callout #{n}" }
  end
end
