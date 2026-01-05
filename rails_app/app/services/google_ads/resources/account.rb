module GoogleAds
  module Resources
    class Account
      include FieldMappable

      attr_reader :record # AdsAccount instance

      # ═══════════════════════════════════════════════════════════════
      # FIELD MAPPINGS
      # ═══════════════════════════════════════════════════════════════

      field_mapping :descriptive_name,
        local: :google_descriptive_name,
        remote: :descriptive_name

      field_mapping :currency_code,
        local: :google_currency_code,
        remote: :currency_code

      field_mapping :time_zone,
        local: :google_time_zone,
        remote: :time_zone

      field_mapping :status,
        local: :google_status,
        remote: ->(r) { r.status.to_s },
        skip_comparison: -> { GoogleAds.is_test_mode? }

      field_mapping :auto_tagging_enabled,
        local: :google_auto_tagging_enabled,
        remote: :auto_tagging_enabled

      def initialize(record)
        @record = record
      end

      # ═══════════════════════════════════════════════════════════════
      # INSTANCE METHODS (5 core methods + sync_plan)
      #
      # Account is a singleton resource per AdsAccount, so no class-level
      # collection methods (sync_all, synced?, sync_plan) are needed.
      # ═══════════════════════════════════════════════════════════════

      def synced?
        remote = fetch
        return false unless remote

        # CANCELED status means not synced
        return false if remote.status == :CANCELED

        fields_match?(remote)
      end

      def sync
        return GoogleAds::SyncResult.unchanged(:customer, customer_id) if synced?

        remote = fetch
        if remote
          update_account(remote)
        else
          create_account
        end
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:customer, e)
      end

      # Returns a SyncResult representing the current sync state without performing any sync.
      # Used by account verification to check if remote customer exists and matches local.
      def sync_result
        remote = fetch
        return GoogleAds::SyncResult.not_found(:customer) unless remote
        return GoogleAds::SyncResult.not_found(:customer) if remote.status == :CANCELED

        if fields_match?(remote)
          GoogleAds::SyncResult.unchanged(:customer, customer_id)
        else
          comparison = compare_fields(remote)
          GoogleAds::SyncResult.error(
            :customer,
            GoogleAds::SyncVerificationError.new(
              "Account sync verification failed. Mismatched fields: #{comparison.failures.join(', ')}"
            )
          )
        end
      end

      def delete
        return GoogleAds::SyncResult.not_found(:customer) unless customer_id.present?

        remote = fetch
        return GoogleAds::SyncResult.error(:customer, StandardError.new("Stale ID: customer not found in Google")) unless remote

        operation = client.operation.update_resource.customer("customers/#{remote.id}") do |c|
          c.status = :CANCELED
        end

        client.service.customer.mutate_customer(
          customer_id: remote.id.to_s,
          operation: operation
        )

        record.google_customer_id = nil
        record.google_status = "CANCELED"
        record.save!

        GoogleAds::SyncResult.deleted(:customer)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:customer, e)
      end

      def fetch
        return fetch_by_id if customer_id.present?
        fetch_by_name
      end

      # ═══════════════════════════════════════════════════════════════
      # SYNC PLAN - dry run planning
      #
      # Returns a Plan showing what sync() WOULD do without executing
      # ═══════════════════════════════════════════════════════════════

      def sync_plan
        remote = fetch

        if remote.nil?
          return GoogleAds::Sync::Plan.new([{ action: :create, record: record }])
        end

        if remote.status == :CANCELED
          return GoogleAds::Sync::Plan.new([{ action: :create, record: record, reason: :canceled_account }])
        end

        if fields_match?(remote)
          return GoogleAds::Sync::Plan.new([{ action: :unchanged, record: record }])
        end

        # Fields don't match - determine what needs updating
        comparison = compare_fields(remote)
        operations = []

        # Check if core fields (descriptive_name) need update
        core_changed = comparison.to_h.slice(:descriptive_name).values.any? { |v| !v[:match] }
        if core_changed
          operations << { action: :update, record: record, fields: [:descriptive_name] }
        end

        # Check if auto_tagging needs separate update
        auto_tagging_changed = comparison.to_h[:auto_tagging_enabled] && !comparison.to_h[:auto_tagging_enabled][:match]
        if auto_tagging_changed
          operations << { action: :update_auto_tagging, record: record }
        end

        # If no specific operations but fields don't match, it's a general update
        if operations.empty?
          operations << { action: :unchanged, record: record }
        end

        GoogleAds::Sync::Plan.new(operations)
      end

      # Custom to_google_json that excludes status (read-only from Google)
      def to_google_json
        {
          descriptive_name: record.google_descriptive_name,
          currency_code: record.google_currency_code,
          time_zone: record.google_time_zone,
          auto_tagging_enabled: record.google_auto_tagging_enabled
        }
      end

      private

      # All field values with transforms applied (via to_google_json)
      def attrs
        @attrs ||= to_google_json
      end

      # ═══════════════════════════════════════════════════════════════
      # FETCH OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      def fetch_by_id
        return nil unless customer_id.present?
        verify_customer(customer_id)
      end

      def fetch_by_name
        return nil unless account.name.present?

        query = <<~QUERY
          SELECT customer_client.id, customer_client.descriptive_name
          FROM customer_client
          WHERE customer_client.descriptive_name = '#{account.name.gsub("'", "\\\\'")}'
        QUERY

        response = client.service.google_ads.search(
          customer_id: mcc_customer_id,
          query: query
        )

        found_id = response.first&.customer_client&.id
        return nil unless found_id

        # Backfill the ID
        record.google_customer_id = found_id.to_s
        record.save!

        verify_customer(found_id)
      end

      def verify_customer(cid)
        sanitized_id = sanitize_customer_id(cid)

        query = <<~QUERY
          SELECT customer_client.id, customer_client.descriptive_name, customer_client.status,
                customer_client.currency_code, customer_client.time_zone
          FROM customer_client
          WHERE customer_client.id = #{sanitized_id}
        QUERY

        response = client.service.google_ads.search(
          customer_id: mcc_customer_id,
          query: query
        )

        row = response.first
        return nil unless row&.customer_client
        customer_client = row.customer_client

        # Separate query for auto_tagging (must query the customer_id itself, not MCC)
        auto_tagging_response = client.service.google_ads.search(
          customer_id: sanitized_id,
          query: "SELECT customer.auto_tagging_enabled FROM customer"
        )

        RemoteAccount.new(
          id: customer_client.id,
          descriptive_name: customer_client.descriptive_name,
          status: customer_client.status,
          auto_tagging_enabled: auto_tagging_response.first&.customer&.auto_tagging_enabled,
          currency_code: customer_client.currency_code,
          time_zone: customer_client.time_zone
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # SYNC OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      def create_account
        unless account.has_google_connected_account?
          raise ArgumentError, "Cannot create Google Ads account without a connected Google account"
        end

        customer = client.resource.customer do |c|
          # Mapped fields (transforms applied via to_google_json)
          c.descriptive_name = attrs[:descriptive_name]
          c.currency_code = attrs[:currency_code]
          c.time_zone = attrs[:time_zone]

          # Non-mapped fields
          c.test_account = GoogleAds.is_test_mode?
        end

        response = client.service.customer.create_customer_client(
          customer_id: mcc_customer_id,
          customer_client: customer
        )

        # Callback logic: set google_customer_id after creation
        new_customer_id = response.resource_name.split("/").last
        record.google_customer_id = new_customer_id
        record.save!

        # Update auto_tagging via separate API call (using attrs for transform consistency)
        update_auto_tagging(new_customer_id, attrs[:auto_tagging_enabled])

        GoogleAds::SyncResult.created(:customer, response.resource_name)
      end

      def update_account(remote)
        comparison = compare_fields(remote)
        resource_name = "customers/#{remote.id}"

        # Update auto_tagging if needed (separate API call)
        if remote.auto_tagging_enabled != attrs[:auto_tagging_enabled]
          update_auto_tagging(remote.id.to_s, attrs[:auto_tagging_enabled])
        end

        # Check if descriptive_name needs update
        name_needs_update = comparison.to_h[:descriptive_name] && !comparison.to_h[:descriptive_name][:match]

        if name_needs_update
          operation = client.operation.update_resource.customer(resource_name) do |c|
            # Only update changed fields, using pre-transformed attrs
            c.descriptive_name = attrs[:descriptive_name]
          end

          client.service.customer.mutate_customer(
            customer_id: remote.id.to_s,
            operation: operation
          )
        end

        GoogleAds::SyncResult.updated(:customer, resource_name)
      end

      def update_auto_tagging(cid, enabled)
        operation = client.operation.update_resource.customer("customers/#{cid}") do |c|
          c.auto_tagging_enabled = enabled
        end

        client.service.customer.mutate_customer(
          customer_id: cid.to_s,
          operation: operation
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # FIELD TRANSFORMS
      # ═══════════════════════════════════════════════════════════════

      def fields_match?(remote)
        compare_fields(remote).match?
      end

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      def client
        GoogleAds.client
      end

      def account
        record.account
      end

      def customer_id
        record.google_customer_id
      end

      def mcc_customer_id
        GoogleAds.config[:login_customer_id]
      end

      def sanitize_customer_id(cid)
        cid.to_s.gsub(/\D/, "")
      end

      # ═══════════════════════════════════════════════════════════════
      # REMOTE ACCOUNT VALUE OBJECT
      # ═══════════════════════════════════════════════════════════════

      class RemoteAccount
        attr_reader :id, :descriptive_name, :status, :auto_tagging_enabled, :currency_code, :time_zone

        def initialize(id:, descriptive_name:, status:, auto_tagging_enabled:, currency_code:, time_zone:)
          @id = id
          @descriptive_name = descriptive_name
          @status = status
          @auto_tagging_enabled = auto_tagging_enabled
          @currency_code = currency_code
          @time_zone = time_zone
        end
      end
    end
  end
end
