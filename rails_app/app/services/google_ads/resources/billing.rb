module GoogleAds
  module Resources
    # Checks billing/payment setup status for a Google Ads account
    #
    # Google Ads requires a valid payment method before campaigns can serve.
    # This resource queries the BillingSetup to check if payment is configured.
    class Billing
      include Instrumentable

      attr_reader :record # AdsAccount instance
      attr_reader :status

      APPROVED_STATUSES = %w[APPROVED APPROVED_HELD].freeze

      def initialize(record)
        @record = record
        @status = record.google_billing_status || "pending"
      end

      def instrumentation_context
        { account_id: record.id, google_customer_id: record.google_customer_id }
      end

      instrument_methods :fetch_status

      def has_payment?
        APPROVED_STATUSES.include?(status.to_s.upcase)
      end

      # Fetches billing setup status from Google Ads API and updates local record
      def fetch_status
        return @status = "none" unless customer_id.present?

        billing_setup = fetch_billing_setup
        @status = billing_setup&.status&.to_s&.downcase || "pending"

        # Persist to local record
        record.google_billing_status = @status
        record.save!

        @status
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        Rails.logger.warn("[GoogleAds::Resources::Billing] Failed to fetch billing status: #{e.message}")
        @status = "error"
      end

      private

      def fetch_billing_setup
        query = <<~QUERY
          SELECT billing_setup.id, billing_setup.status, billing_setup.payments_account
          FROM billing_setup
          WHERE billing_setup.status != 'CANCELLED'
          ORDER BY billing_setup.id DESC
          LIMIT 1
        QUERY

        response = client.service.google_ads.search(
          customer_id: customer_id,
          query: query
        )

        response.first&.billing_setup
      end

      def client
        GoogleAds.client
      end

      def customer_id
        record.google_customer_id
      end
    end
  end
end
