module GoogleAds
  class AccountManager
    include TypeCheck
    attr_accessor :account, :client, :errors

    def self.create_client_account(account)
      new.create_client_account(account)
    end

    def self.cancel_client_account(account)
      new.cancel_client_account(account)
    end

    def self.search
      new.search
    end

    def initialize
      @client = GoogleAds.client
      @errors = []
    end

    # Could actually accept queries, just doing a basic example for now
    def search
      @client.service.google_ads.search(
        customer_id: GoogleAds.config[:login_customer_id],
        query: "SELECT customer.id FROM customer LIMIT 1"
      )
    end

    def create_client_account(account)
      @account = expect_type(account, Account)

      if (existing = find_google_customer_id(account))
        puts "Found existing customer client: #{existing}"
        return existing
      end

      customer = @client.resource.customer do |c|
        c.descriptive_name = account.name
        c.currency_code = "USD"
        c.time_zone = "America/New_York"
      end

      response = @client.service.customer.create_customer_client(
        customer_id: GoogleAds.config[:login_customer_id],
        customer_client: customer,
      )
      customer_id = response.resource_name.split("/").last
      account.update!(google_customer_id: customer_id)
      puts "Created customer client: #{response.resource_name}"
      response
    end

    def cancel_client_account(account)
      @account = expect_type(account, Account)

      customer_id = find_google_customer_id(account)
      raise ArgumentError, "No Google Ads account found for #{account.name}" unless customer_id
      operation = @client.operation.update_resource.customer("customers/#{customer_id}") do |c|
        c.status = :CANCELED
      end

      @client.service.customer.mutate_customer(
        customer_id: customer_id.to_s,
        operation: operation
      )

      account.update!(google_customer_id: nil)
      puts "Canceled customer client: #{customer_id}"
    end

    def find_google_customer_id(account)
      return account.google_customer_id if account.google_customer_id.present?

      query = <<~QUERY
        SELECT customer_client.id, customer_client.descriptive_name
        FROM customer_client
        WHERE customer_client.descriptive_name = '#{account.name.gsub("'", "\\'")}'
      QUERY

      response = @client.service.google_ads.search(
        customer_id: GoogleAds.config[:login_customer_id],
        query: query
      )

      response.first&.customer_client&.id
    end
  end
end