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
class ModelConfig < ApplicationRecord
  # Known model keys for seeding and reference
  KNOWN_MODELS = %w[opus sonnet haiku groq gpt5 gpt5_mini gemini_flash].freeze

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
end
