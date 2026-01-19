# == Schema Information
#
# Table name: model_configs
#
#  id                :bigint           not null, primary key
#  cost_in           :decimal(10, 4)
#  cost_out          :decimal(10, 4)
#  enabled           :boolean          default(TRUE), not null
#  max_usage_percent :integer          default(100)
#  model_card        :string
#  model_key         :string           not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#
# Indexes
#
#  index_model_configs_on_model_card  (model_card)
#  index_model_configs_on_model_key   (model_key) UNIQUE
#
FactoryBot.define do
  factory :model_config do
    sequence(:model_key) { |n| "model_#{n}" }
    enabled { true }
    max_usage_percent { 100 }
    cost_in { nil }
    cost_out { nil }

    trait :opus do
      model_key { 'opus' }
      enabled { false }
      max_usage_percent { 80 }
      cost_in { 15.0 }
      cost_out { 75.0 }
    end

    trait :sonnet do
      model_key { 'sonnet' }
      enabled { true }
      max_usage_percent { 90 }
      cost_in { 3.0 }
      cost_out { 15.0 }
    end

    trait :haiku do
      model_key { 'haiku' }
      enabled { true }
      max_usage_percent { 95 }
      cost_in { 1.0 }
      cost_out { 5.0 }
    end

    trait :haiku3 do
      model_key { 'haiku3' }
      model_card { 'claude-3-5-haiku-latest' }
      enabled { true }
      max_usage_percent { 100 }
      cost_in { 0.25 }
      cost_out { 1.25 }
    end
  end
end
