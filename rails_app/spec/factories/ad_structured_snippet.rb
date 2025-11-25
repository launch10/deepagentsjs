FactoryBot.define do
  factory :ad_structured_snippet do
    association :campaign
    category { "brands" }
    values { ["Nest", "Nexus", "Chromebook"] }
  end
end
