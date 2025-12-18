FactoryBot.define do
  factory :ad_budget do
    association :campaign

    daily_budget_cents { 500 }
  end
end
