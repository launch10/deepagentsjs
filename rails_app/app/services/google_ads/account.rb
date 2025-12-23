module GoogleAds
  class Account < Sync::Syncable
    def account
      local_resource.account
    end

    def fetch_remote
      return fetch_by_id if customer_id.present?
      fetch_by_name
    end

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
        customer_id: GoogleAds.config[:login_customer_id],
        query: query
      )

      found_id = response.first&.customer_client&.id
      return nil unless found_id

      local_resource.google_customer_id = found_id.to_s
      local_resource.save!
      verify_customer(found_id)
    end

    def verify_customer(cid)
      sanitized_id = cid.to_s.gsub(/\D/, "")

      query = <<~QUERY
        SELECT customer_client.id, customer_client.descriptive_name, customer_client.status,
              customer_client.currency_code, customer_client.time_zone
        FROM customer_client
        WHERE customer_client.id = #{sanitized_id}
      QUERY

      response = client.service.google_ads.search(
        customer_id: GoogleAds.config[:login_customer_id],
        query: query
      )

      row = response.first
      return nil unless row&.customer_client
      customer_client = row.customer_client

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

    def sync_result
      return not_found_result(:customer) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :customer,
        resource_name: "customers/#{remote_resource.id}",
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        update_account
      else
        create_account
      end
    end

    def delete
      return not_found_result(:customer) unless remote_resource

      remote_id = remote_resource.id

      operation = client.operation.update_resource.customer("customers/#{remote_id}") do |c|
        c.status = :CANCELED
      end

      client.service.customer.mutate_customer(
        customer_id: remote_id.to_s,
        operation: operation
      )

      local_resource.google_customer_id = nil
      local_resource.google_status = "CANCELED"
      local_resource.save!

      clear_memoization

      Sync::SyncResult.new(
        resource_type: :customer,
        resource_name: "customers/#{remote_id}",
        action: :deleted,
        comparisons: []
      )
    end

    private

    def customer_id
      local_resource&.google_customer_id
    end
    memoize :customer_id

    def create_account
      unless account.has_google_connected_account?
        raise ArgumentError, "Cannot create Google Ads account without a connected Google account"
      end

      customer = client.resource.customer do |c|
        c.descriptive_name = local_resource.google_descriptive_name
        c.currency_code = local_resource.google_currency_code
        c.time_zone = local_resource.google_time_zone
        c.test_account = GoogleAds.is_test_mode?
      end

      response = client.service.customer.create_customer_client(
        customer_id: GoogleAds.config[:login_customer_id],
        customer_client: customer
        # This is not allowed! Needs to be allow-listed?
        # email_address: account.google_email_address
      )

      new_customer_id = response.resource_name.split("/").last
      local_resource.google_customer_id = new_customer_id
      local_resource.save!

      enable_auto_tagging(new_customer_id)

      verify_sync(:created, response.resource_name)
    end

    def update_account
      comparisons = build_comparisons
      resource_name = "customers/#{remote_resource.id}"

      needs_auto_tagging = !remote_resource.auto_tagging_enabled && local_resource.google_auto_tagging_enabled
      enable_auto_tagging(remote_resource.id.to_s) if needs_auto_tagging

      customer_updates_needed = comparisons.any? do |c|
        !c.values_match? && [:descriptive_name].include?(c.their_field)
      end

      if customer_updates_needed
        operation = client.operation.update_resource.customer(resource_name) do |c|
          comparisons.each do |comparison|
            next if comparison.values_match?
            case comparison.their_field
            when :descriptive_name
              c.descriptive_name = comparison.transformed_our_value
            end
          end
        end

        client.service.customer.mutate_customer(
          customer_id: remote_resource.id.to_s,
          operation: operation
        )
      end

      verify_sync(:updated, resource_name)
    end

    def enable_auto_tagging(cid)
      operation = client.operation.update_resource.customer("customers/#{cid}") do |c|
        c.auto_tagging_enabled = true
      end

      client.service.customer.mutate_customer(
        customer_id: cid.to_s,
        operation: operation
      )
    end

    def verify_sync(action, resource_name)
      clear_memoization

      Sync::SyncResult.new(
        resource_type: :customer,
        resource_name: resource_name,
        action: action,
        comparisons: build_comparisons
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
      flush_cache(:customer_id)
    end

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

      def synced?
        status != :CANCELED && auto_tagging_enabled
      end
    end
  end
end
