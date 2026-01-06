module AccountConcerns
  module GoogleAdsAccount
    extend ActiveSupport::Concern

    def google_ads_account
      ads_accounts.find_by(platform: "google")
    end

    def google_customer_id
      google_ads_account&.google_customer_id
    end

    def has_google_ads_account?
      google_customer_id.present? || google_ads_account&.google_syncer&.remote_resource.present?
    end

    def google_ads_billing_url
      customer_id = google_customer_id
      raise "Billing URL not available for accounts without Google customer ID" unless customer_id.present?

      "https://ads.google.com/aw/billing/setup?ocid=#{customer_id}"
    end

    def verify_google_ads_account
      ads_account = find_or_build_google_ads_account
      ads_account.google_sync_result
    end

    def create_google_ads_account
      ads_account = find_or_build_google_ads_account
      ads_account.google_sync
    end

    def dangerously_destroy_google_ads_account!
      return true unless google_ads_account.present?

      google_ads_account.google_delete
      true
    end

    private

    def find_or_build_google_ads_account
      ads_accounts.find_or_initialize_by(platform: "google")
    end
  end
end
