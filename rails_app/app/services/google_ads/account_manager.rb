module GoogleAds
  class AccountManager
    include TypeCheck
    attr_accessor :account, :client, :errors

    def self.create_client_account(account, timezone: nil)
      new.create_client_account(account, timezone: timezone)
    end

    def self.cancel_client_account(account)
      new.cancel_client_account(account)
    end

    def self.verify_customer(customer_id)
      new.verify_customer(customer_id)
    end

    def initialize
      @client = GoogleAds.client
      @errors = []
    end

    def create_client_account(account, timezone: nil)
      @account = expect_type(account, Account)

      if account.google_customer_id.present?
        customer = verify_customer(account.google_customer_id)
        if customer && customer[:status] != :CANCELED
          ensure_auto_tagging_enabled(account.google_customer_id, customer)
          customer[:auto_tagging_enabled] = true
          return customer
        end
      end

      if (found_id = find_google_customer_id_by_name(account.name))
        account.update!(google_customer_id: found_id.to_s)
        customer = verify_customer(found_id)
        ensure_auto_tagging_enabled(found_id.to_s, customer)
        customer[:auto_tagging_enabled] = true
        return customer
      end

      customer = @client.resource.customer do |c|
        c.descriptive_name = account.name
        c.currency_code = account.try(:currency_code).presence || "USD"
        c.time_zone = timezone || account.try(:time_zone).presence || "America/New_York"
        c.test_account = GoogleAds.is_test_mode?
      end

      response = @client.service.customer.create_customer_client(
        customer_id: GoogleAds.config[:login_customer_id],
        customer_client: customer
      )

      customer_id = response.resource_name.split("/").last
      account.update!(google_customer_id: customer_id)

      setup_client_account(customer_id)
    end

    def setup_client_account(customer_id)
      enable_auto_tagging(customer_id)
      verify_customer(customer_id)
    end

    def cancel_client_account(account)
      @account = expect_type(account, Account)

      customer_id = account.google_customer_id.presence || find_google_customer_id_by_name(account.name)
      raise ArgumentError, "No Google Ads account found for #{account.name}" unless customer_id

      operation = @client.operation.update_resource.customer("customers/#{customer_id}") do |c|
        c.status = :CANCELED
      end

      @client.service.customer.mutate_customer(
        customer_id: customer_id.to_s,
        operation: operation
      )

      account.update!(google_customer_id: nil)
    end

    def verify_customer(customer_id)
      sanitized_id = customer_id.to_s.gsub(/\D/, '')

      query = <<~QUERY
        SELECT customer_client.id, customer_client.descriptive_name, customer_client.status,
              customer_client.currency_code, customer_client.time_zone
        FROM customer_client
        WHERE customer_client.id = #{sanitized_id}
      QUERY

      response = @client.service.google_ads.search(
        customer_id: GoogleAds.config[:login_customer_id],
        query: query
      )

      row = response.first
      return nil unless row&.customer_client
      customer_client = row.customer_client

      response = @client.service.google_ads.search(
        customer_id: sanitized_id,
        query: "SELECT customer.auto_tagging_enabled FROM customer"
      )
      return nil unless response.first
      customer = response.first&.customer

      {
        id: customer_client.id,
        descriptive_name: customer_client.descriptive_name,
        status: customer_client.status,
        auto_tagging_enabled: customer&.auto_tagging_enabled,
        currency_code: customer_client.currency_code,
        time_zone: customer_client.time_zone
      }
    end

    def enable_auto_tagging(customer_id)
      operation = @client.operation.update_resource.customer("customers/#{customer_id}") do |c|
        c.auto_tagging_enabled = true
      end

      @client.service.customer.mutate_customer(
        customer_id: customer_id.to_s,
        operation: operation
      )
    end

    def ensure_auto_tagging_enabled(customer_id, customer = nil)
      customer ||= verify_customer(customer_id)
      return if customer && customer[:auto_tagging_enabled]

      enable_auto_tagging(customer_id)
    end

    def find_google_customer_id(account)
      return account.google_customer_id if account.google_customer_id.present?

      find_google_customer_id_by_name(account.name)
    end

    def find_google_customer_id_by_name(name)
      query = <<~QUERY
        SELECT customer_client.id, customer_client.descriptive_name
        FROM customer_client
        WHERE customer_client.descriptive_name = '#{name.gsub("'", "\\'")}'
      QUERY

      response = @client.service.google_ads.search(
        customer_id: GoogleAds.config[:login_customer_id],
        query: query
      )

      response.first&.customer_client&.id
    end
  end
end
