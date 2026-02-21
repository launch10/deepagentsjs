module Testing
  module GoogleAdsResponses
    # ═══════════════════════════════════════════════════════════════
    # INVITATION / USER ACCESS (existing)
    # ═══════════════════════════════════════════════════════════════

    def self.invitation_row(status:, email: "test@launch10.ai")
      OpenStruct.new(
        customer_user_access_invitation: OpenStruct.new(
          resource_name: "customers/123/customerUserAccessInvitations/456",
          email_address: email,
          access_role: :ADMIN,
          invitation_status: status.to_s.upcase.to_sym,
          creation_date_time: Time.current.iso8601
        ),
        customer_user_access: nil
      )
    end

    def self.user_access_row(email: "test@launch10.ai")
      OpenStruct.new(
        customer_user_access: OpenStruct.new(
          resource_name: "customers/123/customerUserAccess/789",
          email_address: email,
          access_role: :ADMIN,
          access_creation_date_time: Time.current.iso8601
        ),
        customer_user_access_invitation: nil
      )
    end

    def self.mutate_invitation_response(customer_id:)
      OpenStruct.new(
        result: OpenStruct.new(
          resource_name: "customers/#{customer_id}/customerUserAccessInvitations/#{rand(10000)}"
        )
      )
    end

    # ═══════════════════════════════════════════════════════════════
    # BILLING
    # ═══════════════════════════════════════════════════════════════

    def self.billing_row(status: "APPROVED")
      OpenStruct.new(
        billing_setup: OpenStruct.new(
          id: 1001,
          status: status.to_s.upcase.to_sym,
          payments_account: "billingAccounts/123/paymentsAccounts/456"
        )
      )
    end

    # ═══════════════════════════════════════════════════════════════
    # CUSTOMER / ACCOUNT
    # ═══════════════════════════════════════════════════════════════

    def self.customer_client_row(customer_id:, descriptive_name: "E2E Test Account", status: :ENABLED)
      OpenStruct.new(
        customer_client: OpenStruct.new(
          id: customer_id.to_i,
          descriptive_name: descriptive_name,
          status: status,
          currency_code: "USD",
          time_zone: "America/New_York"
        )
      )
    end

    def self.auto_tagging_row(enabled: true)
      OpenStruct.new(
        customer: OpenStruct.new(
          auto_tagging_enabled: enabled
        )
      )
    end

    # ═══════════════════════════════════════════════════════════════
    # RESOURCE NAMES
    # ═══════════════════════════════════════════════════════════════

    RESOURCE_PATHS = {
      campaign_budget: "campaignBudgets",
      campaign: "campaigns",
      ad_group: "adGroups",
      ad_group_ad: "adGroupAds",
      ad_group_criterion: "adGroupCriteria",
      campaign_criterion: "campaignCriteria",
      asset: "assets",
      campaign_asset: "campaignAssets",
      customer_user_access_invitation: "customerUserAccessInvitations",
      customer_user_access: "customerUserAccess",
      conversion_action: "conversionActions",
      customer: "customers"
    }.freeze

    # Resources that use composite IDs (parent_id~child_id)
    COMPOSITE_RESOURCES = %i[ad_group_ad ad_group_criterion campaign_criterion].freeze

    def self.resource_name(type, customer_id, id)
      path = RESOURCE_PATHS[type] || type.to_s.camelize(:lower).pluralize
      if COMPOSITE_RESOURCES.include?(type)
        "customers/#{customer_id}/#{path}/0~#{id}"
      else
        "customers/#{customer_id}/#{path}/#{id}"
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # ROW WRAPPING — search results wrap resources in entity-named accessors
    # ═══════════════════════════════════════════════════════════════

    def self.wrap_row(type, resource)
      OpenStruct.new(type => resource)
    end

    # ═══════════════════════════════════════════════════════════════
    # GENERIC MUTATE RESPONSE
    # ═══════════════════════════════════════════════════════════════

    def self.mutate_success(resource_name:)
      OpenStruct.new(
        results: [OpenStruct.new(resource_name: resource_name)]
      )
    end

    def self.mutate_success_singular(resource_name:)
      OpenStruct.new(
        result: OpenStruct.new(resource_name: resource_name)
      )
    end

    def self.create_customer_response(customer_id:, new_customer_id:)
      OpenStruct.new(
        resource_name: "customers/#{customer_id}/customerClients/#{new_customer_id}"
      )
    end
  end
end
