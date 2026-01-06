require 'rails_helper'

RSpec.describe GoogleAds::FieldCompare do
  describe '.build' do
    it 'yields a FieldCompare instance and returns it' do
      result = described_class.build { |c| }
      expect(result).to be_a(described_class)
    end
  end

  describe '#check' do
    it 'adds field to failures when block returns false' do
      compare = described_class.build do |c|
        c.check(:start_hour) { false }
      end

      expect(compare.failures).to eq([:start_hour])
    end

    it 'does not add field when block returns true' do
      compare = described_class.build do |c|
        c.check(:start_hour) { true }
      end

      expect(compare.failures).to be_empty
    end

    it 'returns self for chaining' do
      compare = described_class.new
      expect(compare.check(:foo) { true }).to eq(compare)
    end
  end

  describe '#match?' do
    it 'returns true when no failures' do
      compare = described_class.build do |c|
        c.check(:a) { true }
        c.check(:b) { true }
      end

      expect(compare.match?).to be true
    end

    it 'returns false when any failures exist' do
      compare = described_class.build do |c|
        c.check(:a) { true }
        c.check(:b) { false }
      end

      expect(compare.match?).to be false
    end
  end

  describe '.float_match?' do
    it 'returns true when values are within tolerance' do
      expect(described_class.float_match?(1.0, 1.0005)).to be true
    end

    it 'returns false when values differ beyond tolerance' do
      expect(described_class.float_match?(1.0, 1.01)).to be false
    end

    it 'treats nil as 0.0' do
      expect(described_class.float_match?(nil, 0.0)).to be true
      expect(described_class.float_match?(0.0, nil)).to be true
    end
  end

  describe '#to_h' do
    it 'returns hash with local, remote, and match status for each field' do
      compare = described_class.build do |c|
        c.check(:start_hour, local: 9, remote: 8) { false }
        c.check(:end_hour, local: 17, remote: 17) { true }
      end

      expect(compare.to_h).to eq({
        start_hour: { local: 9, remote: 8, match: false },
        end_hour: { local: 17, remote: 17, match: true }
      })
    end

    it 'works with nil values' do
      compare = described_class.build do |c|
        c.check(:bid_modifier, local: nil, remote: 1.0) { false }
      end

      expect(compare.to_h).to eq({
        bid_modifier: { local: nil, remote: 1.0, match: false }
      })
    end
  end
end
