# == Schema Information
#
# Table name: model_configs
#
#  id                :bigint           not null, primary key
#  cache_reads       :decimal(10, 4)
#  cache_writes      :decimal(10, 4)
#  cost_in           :decimal(10, 4)
#  cost_out          :decimal(10, 4)
#  cost_reasoning    :decimal(10, 4)
#  enabled           :boolean          default(TRUE), not null
#  max_usage_percent :integer          default(100)
#  model_card        :string
#  model_key         :string           not null
#  provider          :string
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#
# Indexes
#
#  index_model_configs_on_model_card  (model_card)
#  index_model_configs_on_model_key   (model_key) UNIQUE
#
class ModelConfig < ApplicationRecord
  include LanggraphCacheClearable

  # Known model keys for seeding and reference
  KNOWN_MODELS = %w[opus sonnet haiku haiku3 groq gpt5 gpt5_mini gemini_flash].freeze

  # Output cost weight for effective cost calculation
  # Output typically dominates real-world spend (3-10x input volume)
  OUTPUT_WEIGHT = 4

  # Price tier thresholds based on weighted effective cost
  # effective_cost = cost_in + (cost_out * OUTPUT_WEIGHT)
  TIER_THRESHOLDS = [
    {tier: 1, min_cost: 100},  # Premium ($100+)
    {tier: 2, min_cost: 40},   # High-end ($40-100)
    {tier: 3, min_cost: 15},   # Mid-tier ($15-40)
    {tier: 4, min_cost: 5},    # Budget ($5-15)
    {tier: 5, min_cost: 0}     # Cheap (<$5)
  ].freeze

  validates :model_key, presence: true, uniqueness: true
  validates :max_usage_percent, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 0,
    less_than_or_equal_to: 100
  }, allow_nil: true

  # Find config by model key
  def self.for(model_key)
    find_by(model_key: model_key)
  end

  # Calculate weighted effective cost
  # Output cost is weighted more heavily as it typically dominates real-world spend
  def effective_cost
    input = cost_in.to_f
    output = cost_out.to_f
    input + (output * OUTPUT_WEIGHT)
  end

  # Determine price tier based on effective cost
  # Tier 1 = most expensive, Tier 5 = cheapest
  def price_tier
    cost = effective_cost
    TIER_THRESHOLDS.find { |t| cost >= t[:min_cost] }&.dig(:tier) || 5
  end
end
