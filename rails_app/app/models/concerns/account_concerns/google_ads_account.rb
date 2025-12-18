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
      find_google_customer_id.present?
    end

    def google_ads_billing_url
      customer_id = google_customer_id
      raise "Billing URL not available for accounts without Google customer ID" unless customer_id.present?

      "https://ads.google.com/aw/billing/setup?ocid=#{customer_id}"
    end

    def find_google_customer_id
      return google_customer_id if google_customer_id.present?

      GoogleAds::AccountManager.new.find_google_customer_id(self)
    end

    def verify_google_ads_account
      customer_id = find_google_customer_id
      return nil unless customer_id.present?

      GoogleAds::AccountManager.new.verify_customer(customer_id)
    end

    def set_google_customer_id
      customer_id = find_google_customer_id
      return "Customer id not found" unless customer_id.present?

      ads_account = ads_accounts.find_or_initialize_by(platform: "google")
      ads_account.google_customer_id = customer_id
      ads_account.save!
    end

    def create_google_ads_account
      GoogleAds::AccountManager.create_client_account(self)
    end

    def dangerously_destroy_google_ads_account!
      GoogleAds::AccountManager.cancel_client_account(self)
      google_ads_account&.update!(google_customer_id: nil)
      true
    end
  end
end
