# == Schema Information
#
# Table name: model_preferences
#
#  id         :bigint           not null, primary key
#  cost_tier  :string           not null
#  model_keys :string           default([]), not null, is an Array
#  skill      :string           not null
#  speed_tier :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  idx_model_preferences_unique  (cost_tier,speed_tier,skill) UNIQUE
#
FactoryBot.define do
  factory :model_preference do
    cost_tier { "paid" }
    speed_tier { "slow" }
    skill { "coding" }
    model_keys { %w[sonnet haiku gpt5] }
  end
end
