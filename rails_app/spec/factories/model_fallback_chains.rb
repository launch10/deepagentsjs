FactoryBot.define do
  factory :model_fallback_chain do
    cost_tier { "paid" }
    speed_tier { "slow" }
    skill { "coding" }
    model_keys { %w[sonnet haiku gpt5] }
  end
end
