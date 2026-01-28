# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::CacheService do
  let(:account) { create(:account) }

  around do |example|
    # Use memory store for cache tests
    original_store = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
    example.run
    Rails.cache = original_store
  end

  describe ".fetch" do
    it "caches results" do
      call_count = 0

      2.times do
        described_class.fetch(account.id, "leads", 30) do
          call_count += 1
          { data: "test" }
        end
      end

      expect(call_count).to eq(1)
    end

    it "returns cached value on second call" do
      result1 = described_class.fetch(account.id, "leads", 30) { { value: 1 } }
      result2 = described_class.fetch(account.id, "leads", 30) { { value: 2 } }

      expect(result1).to eq({ value: 1 })
      expect(result2).to eq({ value: 1 })
    end
  end

  describe ".cache_key" do
    include ActiveSupport::Testing::TimeHelpers

    it "includes account_id, metric, and days" do
      key = described_class.cache_key(account.id, "leads", 30)
      expect(key).to include(account.id.to_s)
      expect(key).to include("leads")
      expect(key).to include("30")
    end

    it "uses 15-minute bucket in cache key" do
      # Start at a known time safely within a 15-minute bucket (minute 1 of the bucket)
      travel_to Time.zone.local(2026, 1, 28, 10, 1, 0) do
        key1 = described_class.cache_key(account.id, "leads", 30)

        travel 10.minutes # Now at minute 11, still same bucket
        key2 = described_class.cache_key(account.id, "leads", 30)

        travel 10.minutes # Now at minute 21, new bucket (15-30)
        key3 = described_class.cache_key(account.id, "leads", 30)

        expect(key1).to eq(key2)
        expect(key1).not_to eq(key3)
      end
    end
  end

  describe ".clear_for_account" do
    it "clears cached data for the account" do
      # Populate cache
      described_class.fetch(account.id, "leads", 30) { { data: "original" } }

      # Clear
      described_class.clear_for_account(account.id)

      # Should recompute
      call_count = 0
      described_class.fetch(account.id, "leads", 30) do
        call_count += 1
        { data: "new" }
      end

      expect(call_count).to eq(1)
    end
  end
end
