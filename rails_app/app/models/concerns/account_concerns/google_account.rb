module AccountConcerns
  module GoogleAccount
    extend ActiveSupport::Concern

    def has_google_account?
      find_google_account_id.present?
    end

    def find_google_account_id
      return google_customer_id if google_customer_id.present?

      GoogleAds::AccountManager.new.find_google_customer_id(self)
    end

    def verify_google_account
      customer_id = find_google_account_id
      return nil unless customer_id.present?

      GoogleAds::AccountManager.new.verify_customer(customer_id)
    end

    def set_google_customer_id
      customer_id = find_google_account_id
      return "Customer id not found" unless customer_id.present?

      update!(google_customer_id: customer_id)
    end

    def create_google_account
      GoogleAds::AccountManager.create_client_account(self)
    end

    def dangerously_destroy_google_account!
      GoogleAds::AccountManager.cancel_client_account(self)
      update!(google_customer_id: nil)
      true
    end
  end
end
