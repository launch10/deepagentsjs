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
require 'rails_helper'

RSpec.describe ModelConfig, type: :model do
  describe 'validations' do
    it 'validates presence of model_key' do
      config = ModelConfig.new(model_key: nil)
      expect(config).not_to be_valid
      expect(config.errors[:model_key]).to include("can't be blank")
    end

    it 'validates uniqueness of model_key' do
      create(:model_config, model_key: 'opus')
      duplicate = build(:model_config, model_key: 'opus')
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:model_key]).to include('has already been taken')
    end

    describe 'max_usage_percent' do
      it 'allows nil' do
        config = build(:model_config, max_usage_percent: nil)
        expect(config).to be_valid
      end

      it 'allows values between 0 and 100' do
        config = build(:model_config, max_usage_percent: 0)
        expect(config).to be_valid

        config.max_usage_percent = 50
        expect(config).to be_valid

        config.max_usage_percent = 100
        expect(config).to be_valid
      end

      it 'rejects values below 0' do
        config = build(:model_config, max_usage_percent: -1)
        expect(config).not_to be_valid
        expect(config.errors[:max_usage_percent]).to include('must be greater than or equal to 0')
      end

      it 'rejects values above 100' do
        config = build(:model_config, max_usage_percent: 101)
        expect(config).not_to be_valid
        expect(config.errors[:max_usage_percent]).to include('must be less than or equal to 100')
      end

      it 'rejects non-integer values' do
        config = build(:model_config, max_usage_percent: 50.5)
        expect(config).not_to be_valid
        expect(config.errors[:max_usage_percent]).to include('must be an integer')
      end
    end
  end

  describe 'defaults' do
    it 'defaults enabled to true' do
      config = ModelConfig.new(model_key: 'test')
      expect(config.enabled).to eq(true)
    end

    it 'defaults max_usage_percent to 100' do
      config = ModelConfig.create!(model_key: 'test')
      expect(config.max_usage_percent).to eq(100)
    end
  end

  describe '.for' do
    it 'finds a config by model_key' do
      config = create(:model_config, model_key: 'sonnet')
      expect(ModelConfig.for('sonnet')).to eq(config)
    end

    it 'returns nil when not found' do
      expect(ModelConfig.for('nonexistent')).to be_nil
    end
  end

  describe 'KNOWN_MODELS' do
    it 'includes expected models' do
      expect(ModelConfig::KNOWN_MODELS).to include('opus', 'sonnet', 'haiku', 'groq', 'gpt5')
    end
  end

  describe 'cost fields' do
    it 'stores decimal costs with precision' do
      config = create(:model_config,
        model_key: 'opus',
        cost_in: 15.0001,
        cost_out: 75.0001)
      config.reload

      expect(config.cost_in).to eq(15.0001)
      expect(config.cost_out).to eq(75.0001)
    end

    it 'allows nil costs' do
      config = build(:model_config, cost_in: nil, cost_out: nil)
      expect(config).to be_valid
    end
  end

  describe '#effective_cost' do
    it 'calculates weighted effective cost with OUTPUT_WEIGHT' do
      # effective_cost = cost_in + (cost_out * OUTPUT_WEIGHT)
      # OUTPUT_WEIGHT = 4
      config = build(:model_config, cost_in: 5.0, cost_out: 25.0)
      # 5.0 + (25.0 * 4) = 5 + 100 = 105
      expect(config.effective_cost).to eq(105.0)
    end

    it 'handles nil costs as zero' do
      config = build(:model_config, cost_in: nil, cost_out: nil)
      expect(config.effective_cost).to eq(0.0)
    end

    it 'handles mixed nil and present costs' do
      config = build(:model_config, cost_in: 3.0, cost_out: nil)
      expect(config.effective_cost).to eq(3.0)

      config = build(:model_config, cost_in: nil, cost_out: 15.0)
      expect(config.effective_cost).to eq(60.0) # 0 + (15 * 4)
    end
  end

  describe '#price_tier' do
    # Tier thresholds: 1 >= 100, 2 >= 40, 3 >= 15, 4 >= 5, 5 < 5

    it 'returns tier 1 for premium models (effective cost >= 100)' do
      # Opus-like: 15 in, 75 out = 15 + (75 * 4) = 15 + 300 = 315
      config = build(:model_config, cost_in: 15.0, cost_out: 75.0)
      expect(config.price_tier).to eq(1)
    end

    it 'returns tier 2 for high-end models (effective cost 40-100)' do
      # Sonnet-like: 3 in, 15 out = 3 + (15 * 4) = 3 + 60 = 63
      config = build(:model_config, cost_in: 3.0, cost_out: 15.0)
      expect(config.price_tier).to eq(2)
    end

    it 'returns tier 3 for mid-tier models (effective cost 15-40)' do
      # Haiku-like: 1 in, 5 out = 1 + (5 * 4) = 1 + 20 = 21
      config = build(:model_config, cost_in: 1.0, cost_out: 5.0)
      expect(config.price_tier).to eq(3)
    end

    it 'returns tier 4 for budget models (effective cost 5-15)' do
      # gpt5_mini-like: 0.25 in, 2 out = 0.25 + (2 * 4) = 0.25 + 8 = 8.25
      config = build(:model_config, cost_in: 0.25, cost_out: 2.0)
      expect(config.price_tier).to eq(4)
    end

    it 'returns tier 5 for cheap models (effective cost < 5)' do
      # Very cheap: 0.1 in, 0.5 out = 0.1 + (0.5 * 4) = 0.1 + 2 = 2.1
      config = build(:model_config, cost_in: 0.1, cost_out: 0.5)
      expect(config.price_tier).to eq(5)
    end

    it 'returns tier 5 for free models (nil costs)' do
      config = build(:model_config, cost_in: nil, cost_out: nil)
      expect(config.price_tier).to eq(5)
    end

    it 'handles boundary values correctly' do
      # Exactly at tier 1 boundary (100)
      config = build(:model_config, cost_in: 0, cost_out: 25.0) # 0 + (25 * 4) = 100
      expect(config.price_tier).to eq(1)

      # Just below tier 1 boundary
      config = build(:model_config, cost_in: 0, cost_out: 24.9) # 0 + (24.9 * 4) = 99.6
      expect(config.price_tier).to eq(2)
    end
  end
end
