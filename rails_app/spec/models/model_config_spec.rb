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
end
