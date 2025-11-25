FactoryBot.define do
  factory :ad do
    association :ad_group
    
    status { "draft" }
  end
end
