module GoogleAdsMocks
  def mock_google_ads_client
    @mock_client = double("Google::Ads::GoogleAds::GoogleAdsClient")
    @mock_customer_service = double("CustomerService")
    @mock_google_ads_service = double("GoogleAdsService")
    @mock_operation = double("Operation")
    @mock_resource = double("Resource")
    @mock_update_resource = double("UpdateResource")

    allow(GoogleAds).to receive(:client).and_return(@mock_client)
    allow(GoogleAds).to receive(:config).and_return({ login_customer_id: "1234567890" })

    allow(@mock_client).to receive(:service).and_return(
      double("Services", customer: @mock_customer_service, google_ads: @mock_google_ads_service)
    )

    allow(@mock_client).to receive(:resource).and_return(@mock_resource)

    allow(@mock_client).to receive(:operation).and_return(@mock_operation)
    allow(@mock_operation).to receive(:update_resource).and_return(@mock_update_resource)

    @mock_client
  end

  def mock_create_customer_client_response(customer_id: "9876543210")
    double("CreateCustomerClientResponse",
      resource_name: "customers/#{customer_id}",
      invitation_link: "")
  end

  def mock_mutate_customer_response(customer_id: "9876543210")
    result = double("MutateCustomerResult",
      resource_name: "customers/#{customer_id}",
      customer: nil)
    double("MutateCustomerResponse", result: result)
  end

  def mock_search_response_with_customer_client(customer_id: 456, descriptive_name: "Test Client")
    customer_client = double("CustomerClient",
      resource_name: "customers/123/customerClients/#{customer_id}",
      id: customer_id,
      descriptive_name: descriptive_name,
      manager: false,
      test_account: false,
      level: 1,
      time_zone: "America/New_York",
      currency_code: "USD",
      hidden: false,
      client_customer: "customers/#{customer_id}",
      status: :ENABLED)
    row = double("GoogleAdsRow", customer_client: customer_client)
    [row]
  end

  def mock_empty_search_response
    []
  end

  def mock_customer_resource
    double("Customer",
      resource_name: "",
      descriptive_name: nil,
      currency_code: nil,
      time_zone: nil,
      test_account: false,
      auto_tagging_enabled: false).tap do |customer|
      allow(customer).to receive(:descriptive_name=)
      allow(customer).to receive(:currency_code=)
      allow(customer).to receive(:time_zone=)
      allow(customer).to receive(:test_account=)
      allow(customer).to receive(:auto_tagging_enabled=)
    end
  end

  def mock_customer_operation
    double("CustomerOperation",
      update: double("Customer", resource_name: "customers/123", status: :CANCELED),
      update_mask: double("FieldMask", paths: ["status"]))
  end

  def mock_search_response_with_customer(
    customer_id: 456,
    descriptive_name: "Test Client",
    auto_tagging_enabled: true,
    status: :ENABLED,
    time_zone: "America/New_York",
    currency_code: "USD"
  )
    customer_client = double("CustomerClient",
      resource_name: "customers/123/customerClients/#{customer_id}",
      id: customer_id,
      descriptive_name: descriptive_name,
      manager: false,
      test_account: false,
      level: 1,
      time_zone: time_zone,
      currency_code: currency_code,
      hidden: false,
      client_customer: "customers/#{customer_id}",
      status: status)
    customer = double("Customer",
      resource_name: "customers/#{customer_id}",
      id: customer_id,
      descriptive_name: descriptive_name,
      currency_code: currency_code,
      time_zone: time_zone,
      auto_tagging_enabled: auto_tagging_enabled,
      test_account: false,
      manager: false,
      status: status)
    row = double("GoogleAdsRow", customer: customer, customer_client: customer_client)
    [row]
  end

  def mock_search_response_with_canceled_customer(customer_id: 456, descriptive_name: "Test Client")
    mock_search_response_with_customer(
      customer_id: customer_id,
      descriptive_name: descriptive_name,
      status: :CANCELED,
      auto_tagging_enabled: false
    )
  end

  def mock_verify_customer_responses(customer_id: 456, descriptive_name: "Test Client", auto_tagging_enabled: true, status: :CLOSED)
    customer_client = double("CustomerClient",
      resource_name: "customers/123/customerClients/#{customer_id}",
      id: customer_id,
      descriptive_name: descriptive_name,
      manager: false,
      test_account: true,
      level: 1,
      time_zone: "America/New_York",
      currency_code: "USD",
      hidden: false,
      client_customer: "customers/#{customer_id}",
      status: status)
    customer_client_row = double("GoogleAdsRow", customer_client: customer_client)

    customer = double("Customer",
      auto_tagging_enabled: auto_tagging_enabled)
    customer_row = double("GoogleAdsRow", customer: customer)

    [[customer_client_row], [customer_row]]
  end

  def mock_verify_customer_canceled_responses(customer_id: 456, descriptive_name: "Test Client")
    mock_verify_customer_responses(
      customer_id: customer_id,
      descriptive_name: descriptive_name,
      status: :CANCELED,
      auto_tagging_enabled: false
    )
  end

  def mock_mutate_customer_response_auto_tagging(customer_id: "9876543210")
    customer = double("Customer",
      resource_name: "customers/#{customer_id}",
      auto_tagging_enabled: true)
    result = double("MutateCustomerResult",
      resource_name: "customers/#{customer_id}",
      customer: customer)
    double("MutateCustomerResponse", result: result)
  end

  def mock_auto_tagging_operation
    double("AutoTaggingOperation",
      update: double("Customer", resource_name: "customers/123", auto_tagging_enabled: true),
      update_mask: double("FieldMask", paths: ["auto_tagging_enabled"]))
  end

  def mock_google_ads_error(message: "Request failed", error_type: :authorization_error, error_value: :USER_PERMISSION_DENIED)
    error_code = double("ErrorCode")
    allow(error_code).to receive(:to_h).and_return({ error_type => error_value })

    location = double("ErrorLocation",
      field_path_elements: [double("FieldPathElement", field_name: "operations", index: 0)])

    individual_error = double("GoogleAdsError",
      message: message,
      location: location,
      error_code: error_code)

    failure = double("GoogleAdsFailure",
      errors: [individual_error],
      request_id: "test-request-id-#{SecureRandom.hex(4)}")

    Google::Ads::GoogleAds::Errors::GoogleAdsError.new(failure)
  end

  def mock_permission_denied_error
    mock_google_ads_error(
      message: "User doesn't have permission to access customer",
      error_type: :authorization_error,
      error_value: :USER_PERMISSION_DENIED
    )
  end

  def mock_customer_not_found_error
    mock_google_ads_error(
      message: "The customer is not found",
      error_type: :customer_error,
      error_value: :CUSTOMER_NOT_FOUND
    )
  end

  def mock_invalid_argument_error
    mock_google_ads_error(
      message: "Request contains an invalid argument",
      error_type: :request_error,
      error_value: :INVALID_INPUT
    )
  end

  def mock_customer_not_enabled_error
    mock_google_ads_error(
      message: "The customer is not enabled.",
      error_type: :customer_error,
      error_value: :CUSTOMER_NOT_ENABLED
    )
  end

  def mock_customer_canceled_error
    mock_google_ads_error(
      message: "The customer account has been canceled.",
      error_type: :customer_error,
      error_value: :CUSTOMER_CANCELED
    )
  end

  def mock_search_response_with_budget(
    budget_id: 123,
    name: "Test Budget",
    amount_micros: 5_000_000,
    delivery_method: :STANDARD
  )
    budget = double("CampaignBudget",
      resource_name: "customers/456/campaignBudgets/#{budget_id}",
      id: budget_id,
      name: name,
      amount_micros: amount_micros,
      delivery_method: delivery_method)
    row = double("GoogleAdsRow", campaign_budget: budget)
    [row]
  end

  def mock_search_response_with_campaign(
    campaign_id: 789,
    customer_id: 456,
    name: "Test Campaign",
    status: :PAUSED,
    advertising_channel_type: :SEARCH,
    bidding_strategy_type: :MANUAL_CPC
  )
    campaign = double("Campaign",
      resource_name: "customers/#{customer_id}/campaigns/#{campaign_id}",
      id: campaign_id,
      name: name,
      status: status,
      advertising_channel_type: advertising_channel_type,
      bidding_strategy_type: bidding_strategy_type)
    row = double("GoogleAdsRow", campaign: campaign)
    [row]
  end

  def mock_search_response_with_ad_group(
    ad_group_id: 999,
    name: "Test Ad Group",
    status: :ENABLED,
    type: :SEARCH_STANDARD,
    cpc_bid_micros: 1_000_000
  )
    ad_group = double("AdGroup",
      resource_name: "customers/456/adGroups/#{ad_group_id}",
      id: ad_group_id,
      name: name,
      status: status,
      type: type,
      cpc_bid_micros: cpc_bid_micros)
    row = double("GoogleAdsRow", ad_group: ad_group)
    [row]
  end

  def mock_search_response_with_bidding_strategy(
    strategy_id: 555,
    name: "Test Strategy",
    type: :TARGET_CPA,
    target_cpa_micros: 10_000_000,
    target_roas: nil
  )
    strategy = double("BiddingStrategy",
      resource_name: "customers/456/biddingStrategies/#{strategy_id}",
      id: strategy_id,
      name: name,
      type: type,
      target_cpa_micros: target_cpa_micros,
      target_roas: target_roas)
    row = double("GoogleAdsRow", bidding_strategy: strategy)
    [row]
  end

  def mock_mutate_budget_response(budget_id: 123, customer_id: 456)
    result = double("MutateCampaignBudgetResult",
      resource_name: "customers/#{customer_id}/campaignBudgets/#{budget_id}")
    double("MutateCampaignBudgetsResponse", results: [result])
  end

  def mock_mutate_campaign_response(campaign_id: 789, customer_id: 456)
    result = double("MutateCampaignResult",
      resource_name: "customers/#{customer_id}/campaigns/#{campaign_id}")
    double("MutateCampaignsResponse", results: [result])
  end

  def mock_mutate_ad_group_response(ad_group_id: 999, customer_id: 456)
    result = double("MutateAdGroupResult",
      resource_name: "customers/#{customer_id}/adGroups/#{ad_group_id}")
    double("MutateAdGroupsResponse", results: [result])
  end

  def mock_mutate_bidding_strategy_response(strategy_id: 555, customer_id: 456)
    result = double("MutateBiddingStrategyResult",
      resource_name: "customers/#{customer_id}/biddingStrategies/#{strategy_id}")
    double("MutateBiddingStrategiesResponse", results: [result])
  end

  def mock_budget_resource
    double("CampaignBudget").tap do |budget|
      allow(budget).to receive(:name=)
      allow(budget).to receive(:amount_micros=)
      allow(budget).to receive(:delivery_method=)
    end
  end

  def mock_campaign_resource
    double("Campaign").tap do |campaign|
      allow(campaign).to receive(:name=)
      allow(campaign).to receive(:status=)
      allow(campaign).to receive(:advertising_channel_type=)
      allow(campaign).to receive(:campaign_budget=)
      allow(campaign).to receive(:bidding_strategy_type=)
      allow(campaign).to receive(:manual_cpc=)
      allow(campaign).to receive(:target_spend=)
      allow(campaign).to receive(:network_settings=)
    end
  end

  def mock_ad_group_resource
    double("AdGroup").tap do |ad_group|
      allow(ad_group).to receive(:name=)
      allow(ad_group).to receive(:status=)
      allow(ad_group).to receive(:type=)
      allow(ad_group).to receive(:campaign=)
      allow(ad_group).to receive(:cpc_bid_micros=)
    end
  end

  def mock_bidding_strategy_resource
    double("BiddingStrategy").tap do |strategy|
      allow(strategy).to receive(:name=)
      allow(strategy).to receive(:type=)
      allow(strategy).to receive(:target_cpa=)
      allow(strategy).to receive(:target_roas=)
    end
  end

  def mock_search_response_with_campaign_criterion(
    criterion_id: 111,
    campaign_id: 789,
    customer_id: 456,
    location_id: 21167,
    negative: false
  )
    location = double("LocationInfo", geo_target_constant: "geoTargetConstants/#{location_id}")
    criterion = double("CampaignCriterion",
      resource_name: "customers/#{customer_id}/campaignCriteria/#{campaign_id}~#{criterion_id}",
      criterion_id: criterion_id,
      campaign: "customers/#{customer_id}/campaigns/#{campaign_id}",
      location: location,
      negative: negative)
    row = double("GoogleAdsRow", campaign_criterion: criterion)
    [row]
  end

  def mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 456)
    result = double("MutateCampaignCriterionResult",
      resource_name: "customers/#{customer_id}/campaignCriteria/#{campaign_id}~#{criterion_id}")
    double("MutateCampaignCriteriaResponse", results: [result])
  end

  def mock_campaign_criterion_resource
    double("CampaignCriterion").tap do |criterion|
      allow(criterion).to receive(:campaign=)
      allow(criterion).to receive(:location=)
      allow(criterion).to receive(:negative=)
    end
  end
end

RSpec.configure do |config|
  config.include GoogleAdsMocks
end
