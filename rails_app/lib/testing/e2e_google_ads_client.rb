require_relative "google_ads_responses"

module Testing
  # Drop-in replacement for the real Google Ads client in E2E tests.
  #
  # Every Google Ads API call flows through GoogleAds.client. When
  # GoogleAds.e2e_mock_client is set, this client is returned instead.
  # It handles search queries, mutations, resource/operation builders,
  # and tracks created resources for subsequent fetches.
  #
  # Usage:
  #   GoogleAds.e2e_mock_client = Testing::E2eGoogleAdsClient.new
  #   GoogleAds.e2e_mock_client.billing_status = "approved"
  #   GoogleAds.e2e_mock_client.invite_status = "accepted"
  #
  class E2eGoogleAdsClient
    # ═══════════════════════════════════════════════════════════════
    # CONFIGURATION
    # ═══════════════════════════════════════════════════════════════

    attr_accessor :invite_status       # "pending", "accepted", "declined", "expired"
    attr_accessor :billing_status      # "approved", "pending", "none"
    attr_accessor :should_error_at     # step name to throw error (e.g., "create_campaign")
    attr_reader :created_resources   # tracks resources for subsequent queries

    def initialize
      @invite_status = nil
      @billing_status = nil
      @should_error_at = nil
      @created_resources = Hash.new { |h, k| h[k] = [] }
      @next_id = 1000
    end

    # ═══════════════════════════════════════════════════════════════
    # CLIENT API — matches Google::Ads::GoogleAds::GoogleAdsClient
    # ═══════════════════════════════════════════════════════════════

    def service
      E2eServiceRouter.new(self)
    end

    def resource
      E2eResourceBuilder.new
    end

    def operation
      E2eOperationBuilder.new
    end

    # ═══════════════════════════════════════════════════════════════
    # RESOURCE TRACKING
    # ═══════════════════════════════════════════════════════════════

    def next_id!
      @next_id += 1
    end

    # Store a created resource for later retrieval via search queries.
    # The resource data (from create/update operations) is preserved
    # so that fields_match? checks pass on subsequent fetches.
    def track_resource(type, id, customer_id, data = nil)
      resource = data.is_a?(OpenStruct) ? data.dup : OpenStruct.new
      resource.id = id
      resource.resource_name = GoogleAdsResponses.resource_name(type, customer_id, id)
      @created_resources[type] << resource
      resource
    end

    # Update an already-tracked resource with new field values
    def update_tracked_resource(type, resource_name, updates)
      resources = @created_resources[type]
      resource = resources.find { |r| r.resource_name == resource_name }
      return unless resource

      updates.each_pair do |key, value|
        next if key.to_s.start_with?("_") # skip internal fields
        resource[key] = value
      end
    end

    def find_resource(type, id: nil, name: nil)
      resources = @created_resources[type]
      if id
        resources.find { |r| r.id == id.to_i }
      elsif name
        resources.find { |r| r.respond_to?(:name) && r.name == name }
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # ERROR INJECTION
    # ═══════════════════════════════════════════════════════════════

    # Maps deploy step names to the resource type they mutate
    STEP_TO_RESOURCE = {
      "sync_budget" => :campaign_budget,
      "create_campaign" => :campaign,
      "create_geo_targeting" => :campaign_criterion,
      "create_schedule" => :campaign_criterion,
      "create_callouts" => :asset,
      "create_structured_snippets" => :asset,
      "create_ad_groups" => :ad_group,
      "create_keywords" => :ad_group_criterion,
      "create_ads" => :ad_group_ad,
      "enable_campaign" => :campaign
    }.freeze

    def check_error!(resource_type)
      return unless should_error_at

      target_type = STEP_TO_RESOURCE[should_error_at]
      should_raise = (target_type == resource_type) || (should_error_at == resource_type.to_s)
      return unless should_raise

      # Raise an error that the sync services catch (Google::Ads::GoogleAds::Errors::GoogleAdsError)
      # If the gem isn't loaded, fall back to RuntimeError
      if defined?(Google::Ads::GoogleAds::Errors::GoogleAdsError)
        # Build a minimal GoogleAdsError with a failure object
        OpenStruct.new(
          details: [],
          code: 3,
          message: "E2E mock error at #{should_error_at}"
        )
        failure = OpenStruct.new(
          errors: [
            OpenStruct.new(
              error_code: OpenStruct.new(to_h: { internal_error: :INTERNAL_ERROR }),
              message: "E2E mock error at #{should_error_at}",
              trigger: nil,
              location: nil
            )
          ],
          request_id: "e2e-mock-#{SecureRandom.hex(8)}"
        )
        error = Google::Ads::GoogleAds::Errors::GoogleAdsError.allocate
        error.instance_variable_set(:@failure, failure)
        error.instance_variable_set(:@status_code, 3)
        # Set the message via the built-in Exception interface
        error.define_singleton_method(:message) { "E2E mock error at #{should_error_at}" }
        error.define_singleton_method(:failure) { failure }
        raise error
      else
        raise StandardError, "E2E mock error at #{should_error_at}"
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # SERVICE ROUTER
    # Routes client.service.{name} to the appropriate mock service
    # ═══════════════════════════════════════════════════════════════

    class E2eServiceRouter
      def initialize(client)
        @client = client
      end

      def google_ads
        E2eSearchService.new(@client)
      end

      def customer
        E2eCustomerService.new(@client)
      end

      def customer_user_access_invitation
        E2eInvitationService.new(@client)
      end

      # All other services (campaign_budget, campaign, ad_group, etc.)
      # use the generic mutate handler
      def method_missing(service_name, *args)
        E2eGenericMutateService.new(@client, service_name)
      end

      def respond_to_missing?(name, include_private = false)
        true
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # SEARCH SERVICE — routes GAQL queries to appropriate responses
    # ═══════════════════════════════════════════════════════════════

    class E2eSearchService
      def initialize(client)
        @client = client
      end

      def search(customer_id:, query:)
        Rails.logger.debug "[E2eGoogleAdsClient] SEARCH customer_id=#{customer_id} query=#{query.squish}" if defined?(Rails)
        route_query(customer_id, query)
      end

      private

      def route_query(customer_id, query)
        case query
        when /billing_setup/
          billing_rows
        when /customer_user_access_invitation/
          invitation_rows
        when /customer_user_access[^_]/
          user_access_rows
        when /customer_client/
          customer_client_rows(customer_id, query)
        when /customer\.auto_tagging/
          auto_tagging_rows
        when /FROM\s+campaign_budget/i
          find_tracked_rows(:campaign_budget, query)
        when /FROM\s+campaign_criterion/i
          find_tracked_rows(:campaign_criterion, query)
        when /FROM\s+campaign_asset/i
          find_tracked_rows(:campaign_asset, query)
        when /FROM\s+campaign[^_]/i
          find_tracked_rows(:campaign, query)
        when /FROM\s+ad_group_ad/i
          find_tracked_rows(:ad_group_ad, query)
        when /FROM\s+ad_group_criterion/i
          find_tracked_rows(:ad_group_criterion, query)
        when /FROM\s+ad_group[^_]/i
          find_tracked_rows(:ad_group, query)
        when /FROM\s+asset/i
          find_tracked_rows(:asset, query)
        when /FROM\s+conversion_action/i
          find_tracked_rows(:conversion_action, query)
        else
          Rails.logger.debug "[E2eGoogleAdsClient] SEARCH unhandled query: #{query.squish}" if defined?(Rails)
          []
        end
      end

      # ─── Billing ───

      def billing_rows
        status = @client.billing_status || "approved"
        return [] if status == "none"
        [GoogleAdsResponses.billing_row(status: status)]
      end

      # ─── Invitation / User Access ───

      def invitation_rows
        status = @client.invite_status
        return [] if status.nil? || status == "accepted"
        [GoogleAdsResponses.invitation_row(status: status)]
      end

      def user_access_rows
        status = @client.invite_status
        return [GoogleAdsResponses.user_access_row] if status == "accepted"
        []
      end

      # ─── Customer / Account ───

      def customer_client_rows(customer_id, query)
        if query =~ /customer_client\.id\s*=\s*(\d+)/
          [GoogleAdsResponses.customer_client_row(customer_id: $1)]
        elsif query =~ /customer_client\.descriptive_name\s*=\s*'([^']+)'/
          [GoogleAdsResponses.customer_client_row(customer_id: customer_id, descriptive_name: $1)]
        else
          []
        end
      end

      def auto_tagging_rows
        [GoogleAdsResponses.auto_tagging_row]
      end

      # ─── Tracked Resources ───
      # Finds resources that were previously created via mutations

      def find_tracked_rows(type, query)
        resource = find_by_query(type, query)
        return [] unless resource
        [GoogleAdsResponses.wrap_row(type, resource)]
      end

      def find_by_query(type, query)
        # Try ID-based lookups first (most common for synced? checks)
        if query =~ /\.id\s*=\s*(\d+)/
          return @client.find_resource(type, id: $1.to_i)
        end
        if query =~ /\.criterion_id\s*=\s*(\d+)/
          return @client.find_resource(type, id: $1.to_i)
        end

        # Name-based lookup (fallback for fetch_by_name)
        if query =~ /\.name\s*=\s*'([^']+)'/
          return @client.find_resource(type, name: $1)
        end

        # Text-based lookup for assets (callouts, snippets)
        if query =~ /callout_text\s*=\s*'([^']+)'/
          return @client.find_resource(type, name: $1)
        end
        if query =~ /\.header\s*=\s*'([^']+)'/
          return @client.find_resource(type, name: $1)
        end

        nil
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # GENERIC MUTATE SERVICE
    # Handles all standard mutate_* calls for any resource type
    # ═══════════════════════════════════════════════════════════════

    class E2eGenericMutateService
      def initialize(client, resource_type)
        @client = client
        @resource_type = resource_type
      end

      def method_missing(method_name, customer_id: nil, operations: nil, operation: nil, **_kwargs)
        if method_name.to_s.start_with?("mutate_")
          handle_mutate(customer_id: customer_id, operations: operations, operation: operation)
        else
          super
        end
      end

      def respond_to_missing?(name, include_private = false)
        name.to_s.start_with?("mutate_") || super
      end

      private

      def handle_mutate(customer_id:, operations:, operation:)
        @client.check_error!(@resource_type)

        ops = operation ? [operation] : (operations || [])
        cid = customer_id || "0"

        results = ops.map do |op|
          if op.respond_to?(:_action) && op._action == :update && op.respond_to?(:_resource_name)
            # Update: apply changes to tracked resource
            @client.update_tracked_resource(@resource_type, op._resource_name, op)
            OpenStruct.new(resource_name: op._resource_name)
          elsif op.respond_to?(:_action) && op._action == :remove && op.respond_to?(:_resource_name)
            # Remove: just return the resource_name
            OpenStruct.new(resource_name: op._resource_name)
          else
            # Create: track new resource
            id = @client.next_id!
            resource = @client.track_resource(@resource_type, id, cid, op)
            Rails.logger.debug "[E2eGoogleAdsClient] MUTATE created #{@resource_type} id=#{id} resource_name=#{resource.resource_name}" if defined?(Rails)
            OpenStruct.new(resource_name: resource.resource_name)
          end
        end

        if operation
          # Singular operation style (e.g., customer_user_access)
          OpenStruct.new(result: results.first)
        else
          # Batch operation style (most services)
          OpenStruct.new(results: results)
        end
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # CUSTOMER SERVICE
    # Handles create_customer_client and mutate_customer
    # ═══════════════════════════════════════════════════════════════

    class E2eCustomerService
      def initialize(client)
        @client = client
      end

      def create_customer_client(customer_id:, customer_client:)
        @client.check_error!(:customer)
        id = @client.next_id!
        @client.track_resource(:customer, id, customer_id, customer_client)
        GoogleAdsResponses.create_customer_response(customer_id: customer_id, new_customer_id: id)
      end

      def mutate_customer(customer_id:, operation:)
        @client.check_error!(:customer)
        # Apply updates if this is an update operation
        if operation.respond_to?(:_resource_name)
          @client.update_tracked_resource(:customer, operation._resource_name, operation)
        end
        OpenStruct.new(
          result: OpenStruct.new(resource_name: "customers/#{customer_id}")
        )
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INVITATION SERVICE (preserved from original)
    # ═══════════════════════════════════════════════════════════════

    class E2eInvitationService
      def initialize(client)
        @client = client
      end

      def mutate_customer_user_access_invitation(customer_id:, operation:)
        @client.check_error!(:customer_user_access_invitation)
        GoogleAdsResponses.mutate_invitation_response(customer_id: customer_id)
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # RESOURCE BUILDER
    # client.resource.{type} { |r| ... } → yields OpenStruct, returns it
    # ═══════════════════════════════════════════════════════════════

    class E2eResourceBuilder
      def method_missing(resource_type, *args, &block)
        resource = OpenStruct.new
        yield resource if block
        resource
      end

      def respond_to_missing?(name, include_private = false)
        true
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # OPERATION BUILDER
    # client.operation.{create|update|remove}_resource.{type}(...)
    # ═══════════════════════════════════════════════════════════════

    class E2eOperationBuilder
      def create_resource
        E2eCreateResource.new
      end

      def update_resource
        E2eUpdateResource.new
      end

      def remove_resource
        E2eRemoveResource.new
      end
    end

    # client.operation.create_resource.campaign_budget { |b| b.name = "..." }
    class E2eCreateResource
      def method_missing(resource_type, resource = nil, &block)
        op = resource.is_a?(OpenStruct) ? resource.dup : OpenStruct.new
        op._type = resource_type
        op._action = :create
        yield op if block
        op
      end

      def respond_to_missing?(name, include_private = false)
        true
      end
    end

    # client.operation.update_resource.campaign(resource_name) { |c| c.status = :ENABLED }
    class E2eUpdateResource
      def method_missing(resource_type, identifier = nil, &block)
        op = OpenStruct.new
        op._type = resource_type
        op._action = :update
        if identifier.is_a?(String)
          op._resource_name = identifier
        elsif identifier.respond_to?(:resource_name)
          op._resource_name = identifier.resource_name
        end
        yield op if block
        op
      end

      def respond_to_missing?(name, include_private = false)
        true
      end
    end

    # client.operation.remove_resource.campaign(resource_name)
    class E2eRemoveResource
      def method_missing(resource_type, resource_name = nil, &block)
        OpenStruct.new(
          _type: resource_type,
          _action: :remove,
          _resource_name: resource_name
        )
      end

      def respond_to_missing?(name, include_private = false)
        true
      end
    end
  end
end
