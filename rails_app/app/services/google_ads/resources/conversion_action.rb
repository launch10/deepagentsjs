module GoogleAds
  module Resources
    class ConversionAction
      include Instrumentable

      attr_reader :record # AdsAccount instance

      def initialize(record)
        @record = record
      end

      def instrumentation_context
        { account_id: record.id, google_customer_id: record.google_customer_id }
      end

      instrument_methods :sync, :create_lead_form_conversion_action, :fetch_conversion_info

      # ═══════════════════════════════════════════════════════════════
      # SYNC - Main entry point
      # ═══════════════════════════════════════════════════════════════

      def sync
        return GoogleAds::SyncResult.unchanged(:conversion_action, record.google_conversion_action_resource_name) if synced?

        result = create_lead_form_conversion_action
        return result if result.error?

        # Fetch and store conversion info (ID with AW- prefix and label) from tag_snippets
        conversion_info = fetch_conversion_info(result.resource_name)
        record.google_conversion_action_resource_name = result.resource_name
        record.google_conversion_id = conversion_info[:conversion_id]
        record.google_conversion_label = conversion_info[:conversion_label]
        record.save!

        result
      end

      def synced?
        record.google_conversion_action_resource_name.present? &&
          record.google_conversion_id.present? &&
          record.google_conversion_label.present?
      end

      # ═══════════════════════════════════════════════════════════════
      # CREATE LEAD FORM CONVERSION ACTION
      # ═══════════════════════════════════════════════════════════════

      def create_lead_form_conversion_action
        conversion_action = client.resource.conversion_action do |ca|
          ca.name = "Lead Form Submission"
          ca.type = :WEBPAGE
          ca.category = :SUBMIT_LEAD_FORM
          ca.status = :ENABLED
          ca.counting_type = :ONE_PER_CLICK
          ca.click_through_lookback_window_days = 30
          ca.view_through_lookback_window_days = 1
          ca.attribution_model_settings = client.resource.attribution_model_settings do |ams|
            ams.attribution_model = :GOOGLE_SEARCH_ATTRIBUTION_DATA_DRIVEN
          end
          ca.value_settings = client.resource.value_settings do |vs|
            vs.default_value = 0
            vs.default_currency_code = "USD"
            vs.always_use_default_value = false
          end
        end

        operation = client.operation.create_resource.conversion_action(conversion_action)
        response = client.service.conversion_action.mutate_conversion_actions(
          customer_id: customer_id,
          operations: [operation]
        )

        resource_name = response.results.first.resource_name
        GoogleAds::SyncResult.created(:conversion_action, resource_name)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:conversion_action, e)
      end

      # ═══════════════════════════════════════════════════════════════
      # FETCH CONVERSION INFO FROM TAG SNIPPETS
      # Parses both conversion_id (with AW- prefix) and conversion_label
      # from the tag_snippet's send_to value: 'AW-123456789/abc123XYZ'
      # ═══════════════════════════════════════════════════════════════

      def fetch_conversion_info(resource_name)
        query = <<~QUERY
          SELECT conversion_action.tag_snippets
          FROM conversion_action
          WHERE conversion_action.resource_name = '#{resource_name}'
        QUERY

        response = client.service.google_ads.search(
          customer_id: customer_id,
          query: query
        )

        row = response.first
        return { conversion_id: nil, conversion_label: nil } unless row

        row.conversion_action.tag_snippets.each do |snippet|
          next unless snippet.type == :WEBPAGE && snippet.event_snippet

          # Extract both conversion_id and label from the event_snippet
          # Format: gtag('event', 'conversion', {'send_to': 'AW-123456789/abc123XYZ'});
          match = snippet.event_snippet.match(/send_to['"]:\s*['"](AW-\d+)\/([^'"]+)['"]/)
          if match
            return { conversion_id: match[1], conversion_label: match[2] }
          end
        end

        { conversion_id: nil, conversion_label: nil }
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError
        { conversion_id: nil, conversion_label: nil }
      end

      private

      def client
        GoogleAds.client
      end

      def customer_id
        record.google_customer_id
      end
    end
  end
end
