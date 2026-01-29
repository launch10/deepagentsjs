# frozen_string_literal: true

require "rails_helper"

RSpec.describe GoogleAds::SyncPerformanceWorker do
  # Freeze to 12:01am EST to test timezone handling
  around do |example|
    Timecop.freeze(Time.new(2026, 1, 29, 0, 1, 0, "-05:00")) do
      example.run
    end
  end

  describe ".eligible_ads_accounts" do
    let(:subscribed_account) { create(:account) }
    let!(:subscribed_ads_account) do
      ads_account = create(:ads_account, account: subscribed_account, platform: "google")
      ads_account.google_customer_id = "123-456-7890"
      ads_account.save!
      ads_account
    end

    before do
      ensure_plans_exist
      subscribe_account(subscribed_account, plan_name: "growth_monthly")
    end

    it "returns ads accounts with customer IDs and active subscriptions" do
      expect(described_class.eligible_ads_accounts).to include(subscribed_ads_account)
    end

    it "excludes ads accounts without subscriptions" do
      unsubscribed_account = create(:account)
      unsubscribed_ads_account = create(:ads_account, account: unsubscribed_account, platform: "google")
      unsubscribed_ads_account.google_customer_id = "999-888-7777"
      unsubscribed_ads_account.save!

      expect(described_class.eligible_ads_accounts).not_to include(unsubscribed_ads_account)
    end

    it "excludes ads accounts without customer ID" do
      subscribed_ads_account.google_customer_id = nil
      subscribed_ads_account.save!

      expect(described_class.eligible_ads_accounts).not_to include(subscribed_ads_account)
    end

    it "excludes ads accounts with empty customer ID" do
      subscribed_ads_account.google_customer_id = ""
      subscribed_ads_account.save!

      expect(described_class.eligible_ads_accounts).not_to include(subscribed_ads_account)
    end

    it "excludes non-Google ads accounts" do
      meta_account = create(:ads_account, account: subscribed_account, platform: "meta")
      expect(described_class.eligible_ads_accounts).not_to include(meta_account)
    end

    it "excludes ads accounts with canceled subscriptions" do
      unsubscribe_account(subscribed_account)
      expect(described_class.eligible_ads_accounts).not_to include(subscribed_ads_account)
    end
  end

  describe "#perform" do
    let(:account) { create(:account) }
    let!(:ads_account) do
      ads_account = create(:ads_account, account: account, platform: "google")
      ads_account.google_customer_id = "123-456-7890"
      ads_account.save!
      ads_account
    end

    before do
      ensure_plans_exist
      subscribe_account(account, plan_name: "growth_monthly")
    end

    it "enqueues a job for each eligible ads account" do
      expect(GoogleAds::SyncPerformanceForAccountWorker).to receive(:perform_async)
        .with(ads_account.id)

      subject.perform
    end
  end
end
