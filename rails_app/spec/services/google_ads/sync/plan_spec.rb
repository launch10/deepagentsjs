require 'rails_helper'

RSpec.describe GoogleAds::Sync::Plan do
  describe 'initialization' do
    it 'accepts an array of operations' do
      operations = [
        { action: :create, record: double("Record"), resource_type: :campaign_criterion }
      ]
      plan = described_class.new(operations)
      expect(plan.operations).to eq(operations)
    end

    it 'defaults to empty operations array' do
      plan = described_class.new
      expect(plan.operations).to eq([])
    end
  end

  describe 'operation filtering' do
    let(:create_op) { { action: :create, record: double("Record1"), resource_type: :campaign_criterion } }
    let(:update_op) { { action: :update, record: double("Record2"), resource_type: :campaign_criterion, reason: :fields_mismatch } }
    let(:delete_op) { { action: :delete, criterion_id: 888, resource_type: :campaign_criterion } }
    let(:unchanged_op) { { action: :unchanged, record: double("Record3"), resource_type: :campaign_criterion } }
    let(:plan) { described_class.new([create_op, update_op, delete_op, unchanged_op]) }

    describe '#creates' do
      it 'returns only create operations' do
        expect(plan.creates).to eq([create_op])
      end
    end

    describe '#updates' do
      it 'returns only update operations' do
        expect(plan.updates).to eq([update_op])
      end
    end

    describe '#deletes' do
      it 'returns only delete operations' do
        expect(plan.deletes).to eq([delete_op])
      end
    end

    describe '#unchanged' do
      it 'returns only unchanged operations' do
        expect(plan.unchanged).to eq([unchanged_op])
      end
    end
  end

  describe '#any_changes?' do
    context 'when there are creates' do
      it 'returns true' do
        plan = described_class.new([{ action: :create, record: double("Record") }])
        expect(plan.any_changes?).to be true
      end
    end

    context 'when there are updates' do
      it 'returns true' do
        plan = described_class.new([{ action: :update, record: double("Record") }])
        expect(plan.any_changes?).to be true
      end
    end

    context 'when there are deletes' do
      it 'returns true' do
        plan = described_class.new([{ action: :delete, criterion_id: 888 }])
        expect(plan.any_changes?).to be true
      end
    end

    context 'when only unchanged operations' do
      it 'returns false' do
        plan = described_class.new([{ action: :unchanged, record: double("Record") }])
        expect(plan.any_changes?).to be false
      end
    end

    context 'when empty' do
      it 'returns false' do
        plan = described_class.new([])
        expect(plan.any_changes?).to be false
      end
    end
  end

  describe '#empty?' do
    it 'returns true when no operations' do
      plan = described_class.new([])
      expect(plan.empty?).to be true
    end

    it 'returns false when operations exist' do
      plan = described_class.new([{ action: :create, record: double("Record") }])
      expect(plan.empty?).to be false
    end
  end

  describe '#to_h' do
    it 'returns a summary hash' do
      create_op = { action: :create, record: double("Record1") }
      delete_op = { action: :delete, criterion_id: 888 }
      unchanged_op = { action: :unchanged, record: double("Record2") }

      plan = described_class.new([create_op, delete_op, unchanged_op])
      hash = plan.to_h

      expect(hash[:creates]).to eq(1)
      expect(hash[:updates]).to eq(0)
      expect(hash[:deletes]).to eq(1)
      expect(hash[:unchanged]).to eq(1)
      expect(hash[:any_changes]).to be true
      expect(hash[:operations]).to eq([create_op, delete_op, unchanged_op])
    end
  end

  describe '.merge' do
    it 'combines multiple plans into one' do
      plan1 = described_class.new([{ action: :create, record: double("Record1") }])
      plan2 = described_class.new([{ action: :delete, criterion_id: 888 }])

      merged = described_class.merge(plan1, plan2)

      expect(merged.operations.size).to eq(2)
      expect(merged.creates.size).to eq(1)
      expect(merged.deletes.size).to eq(1)
    end

    it 'handles empty plans' do
      plan1 = described_class.new([])
      plan2 = described_class.new([{ action: :create, record: double("Record1") }])

      merged = described_class.merge(plan1, plan2)

      expect(merged.operations.size).to eq(1)
    end
  end
end
