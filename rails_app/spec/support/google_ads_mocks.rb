module GoogleAdsMocks
  def mock_google_ads_client
    @mock_client = double("Google::Ads::GoogleAds::GoogleAdsClient")
    @mock_customer_service = double("CustomerService")
    @mock_google_ads_service = double("GoogleAdsService")
    @mock_campaign_budget_service = double("CampaignBudgetService")
    @mock_campaign_service = double("CampaignService")
    @mock_ad_group_service = double("AdGroupService")
    @mock_bidding_strategy_service = double("BiddingStrategyService")
    @mock_campaign_criterion_service = double("CampaignCriterionService")
    @mock_ad_group_criterion_service = double("AdGroupCriterionService")
    @mock_ad_group_ad_service = double("AdGroupAdService")
    @mock_asset_service = double("AssetService")
    @mock_campaign_asset_service = double("CampaignAssetService")
    @mock_operation = double("Operation")
    @mock_resource = double("Resource")
    @mock_update_resource = double("UpdateResource")

    allow(GoogleAds).to receive(:client).and_return(@mock_client)
    allow(GoogleAds).to receive(:config).and_return({ login_customer_id: "1234567890" })

    allow(@mock_client).to receive(:service).and_return(
      double("Services",
        customer: @mock_customer_service,
        google_ads: @mock_google_ads_service,
        campaign_budget: @mock_campaign_budget_service,
        campaign: @mock_campaign_service,
        ad_group: @mock_ad_group_service,
        bidding_strategy: @mock_bidding_strategy_service,
        campaign_criterion: @mock_campaign_criterion_service,
        ad_group_criterion: @mock_ad_group_criterion_service,
        ad_group_ad: @mock_ad_group_ad_service,
        asset: @mock_asset_service,
        campaign_asset: @mock_campaign_asset_service)
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
    customer_id: 456,
    name: "Test Ad Group",
    status: :ENABLED,
    type: :SEARCH_STANDARD,
    cpc_bid_micros: 1_000_000
  )
    ad_group = double("AdGroup",
      resource_name: "customers/#{customer_id}/adGroups/#{ad_group_id}",
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
    negative: false,
    bid_modifier: nil
  )
    location = double("LocationInfo", geo_target_constant: "geoTargetConstants/#{location_id}")
    criterion = double("CampaignCriterion",
      resource_name: "customers/#{customer_id}/campaignCriteria/#{campaign_id}~#{criterion_id}",
      criterion_id: criterion_id,
      campaign: "customers/#{customer_id}/campaigns/#{campaign_id}",
      location: location,
      negative: negative,
      bid_modifier: bid_modifier)
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
      allow(criterion).to receive(:bid_modifier=)
    end
  end

  def mock_location_info_resource
    double("LocationInfo").tap do |location|
      allow(location).to receive(:geo_target_constant=)
    end
  end

  def mock_search_response_with_ad_schedule(
    criterion_id: 222,
    campaign_id: 789,
    customer_id: 456,
    day_of_week: :MONDAY,
    start_hour: 9,
    start_minute: :ZERO,
    end_hour: 17,
    end_minute: :ZERO,
    bid_modifier: nil
  )
    ad_schedule = double("AdScheduleInfo",
      day_of_week: day_of_week,
      start_hour: start_hour,
      start_minute: start_minute,
      end_hour: end_hour,
      end_minute: end_minute)
    criterion = double("CampaignCriterion",
      resource_name: "customers/#{customer_id}/campaignCriteria/#{campaign_id}~#{criterion_id}",
      criterion_id: criterion_id,
      campaign: "customers/#{customer_id}/campaigns/#{campaign_id}",
      ad_schedule: ad_schedule,
      bid_modifier: bid_modifier)
    row = double("GoogleAdsRow", campaign_criterion: criterion)
    [row]
  end

  def mock_ad_schedule_info_resource
    double("AdScheduleInfo").tap do |schedule|
      allow(schedule).to receive(:day_of_week=)
      allow(schedule).to receive(:start_hour=)
      allow(schedule).to receive(:start_minute=)
      allow(schedule).to receive(:end_hour=)
      allow(schedule).to receive(:end_minute=)
    end
  end

  def mock_campaign_criterion_with_ad_schedule_resource
    double("CampaignCriterion").tap do |criterion|
      allow(criterion).to receive(:campaign=)
      allow(criterion).to receive(:ad_schedule=)
      allow(criterion).to receive(:bid_modifier=)
    end
  end

  def mock_search_response_with_keyword(
    criterion_id: 333,
    ad_group_id: 999,
    customer_id: 456,
    keyword_text: "test keyword",
    match_type: :BROAD,
    status: :ENABLED,
    cpc_bid_micros: nil,
    negative: false
  )
    keyword = double("KeywordInfo",
      text: keyword_text,
      match_type: match_type)
    criterion = double("AdGroupCriterion",
      resource_name: "customers/#{customer_id}/adGroupCriteria/#{ad_group_id}~#{criterion_id}",
      criterion_id: criterion_id,
      ad_group: "customers/#{customer_id}/adGroups/#{ad_group_id}",
      keyword: keyword,
      status: status,
      cpc_bid_micros: cpc_bid_micros,
      negative: negative)
    row = double("GoogleAdsRow", ad_group_criterion: criterion)
    [row]
  end

  def mock_mutate_ad_group_criterion_response(criterion_id: 333, ad_group_id: 999, customer_id: 456)
    result = double("MutateAdGroupCriterionResult",
      resource_name: "customers/#{customer_id}/adGroupCriteria/#{ad_group_id}~#{criterion_id}")
    double("MutateAdGroupCriteriaResponse", results: [result])
  end

  def mock_ad_group_criterion_resource
    double("AdGroupCriterion").tap do |criterion|
      allow(criterion).to receive(:ad_group=)
      allow(criterion).to receive(:keyword=)
      allow(criterion).to receive(:status=)
      allow(criterion).to receive(:cpc_bid_micros=)
      allow(criterion).to receive(:negative=)
    end
  end

  def mock_keyword_info_resource
    double("KeywordInfo").tap do |keyword|
      allow(keyword).to receive(:text=)
      allow(keyword).to receive(:match_type=)
    end
  end

  def mock_search_response_with_ad_group_ad(
    ad_id: 12345,
    ad_group_id: 999,
    customer_id: 456,
    status: :PAUSED,
    final_urls: ["https://example.com"],
    headlines: [],
    descriptions: [],
    path1: nil,
    path2: nil
  )
    rsa = double("ResponsiveSearchAdInfo",
      headlines: headlines,
      descriptions: descriptions,
      path1: path1,
      path2: path2)

    ad = double("Ad",
      id: ad_id,
      final_urls: final_urls,
      responsive_search_ad: rsa)

    ad_group_ad = double("AdGroupAd",
      resource_name: "customers/#{customer_id}/adGroupAds/#{ad_group_id}~#{ad_id}",
      ad: ad,
      status: status,
      ad_group: "customers/#{customer_id}/adGroups/#{ad_group_id}")

    row = double("GoogleAdsRow", ad_group_ad: ad_group_ad)
    [row]
  end

  def mock_mutate_ad_group_ad_response(ad_id: 12345, ad_group_id: 999, customer_id: 456)
    result = double("MutateAdGroupAdResult",
      resource_name: "customers/#{customer_id}/adGroupAds/#{ad_group_id}~#{ad_id}")
    double("MutateAdGroupAdsResponse", results: [result])
  end

  def mock_ad_group_ad_resource
    double("AdGroupAd").tap do |aga|
      allow(aga).to receive(:ad_group=)
      allow(aga).to receive(:status=)
      allow(aga).to receive(:ad=)
    end
  end

  def mock_ad_resource
    final_urls_array = []
    double("Ad").tap do |ad|
      allow(ad).to receive(:final_urls).and_return(final_urls_array)
      allow(ad).to receive(:final_urls=)
      allow(ad).to receive(:responsive_search_ad=)
    end
  end

  def mock_responsive_search_ad_info_resource
    headlines_array = []
    descriptions_array = []
    double("ResponsiveSearchAdInfo").tap do |rsa|
      allow(rsa).to receive(:headlines).and_return(headlines_array)
      allow(rsa).to receive(:descriptions).and_return(descriptions_array)
      allow(rsa).to receive(:path1=)
      allow(rsa).to receive(:path2=)
    end
  end

  def mock_ad_text_asset_resource
    double("AdTextAsset").tap do |asset|
      allow(asset).to receive(:text=)
      allow(asset).to receive(:pinned_field=)
    end
  end

  def mock_search_response_with_asset(
    asset_id: 77777,
    customer_id: 456,
    name: "Test Business Logo",
    type: :IMAGE,
    file_size: 1024,
    mime_type: :IMAGE_PNG
  )
    image_asset = double("ImageAsset",
      file_size: file_size,
      mime_type: mime_type)

    asset = double("Asset",
      resource_name: "customers/#{customer_id}/assets/#{asset_id}",
      id: asset_id,
      name: name,
      type: type,
      image_asset: image_asset)

    row = double("GoogleAdsRow", asset: asset)
    [row]
  end

  def mock_mutate_asset_response(asset_id: 77777, customer_id: 456)
    result = double("MutateAssetResult",
      resource_name: "customers/#{customer_id}/assets/#{asset_id}")
    double("MutateAssetsResponse", results: [result])
  end

  def mock_mutate_campaign_asset_response(asset_id: 77777, campaign_id: 789, customer_id: 456)
    result = double("MutateCampaignAssetResult",
      resource_name: "customers/#{customer_id}/campaignAssets/#{campaign_id}~#{asset_id}")
    double("MutateCampaignAssetsResponse", results: [result])
  end

  def mock_asset_resource
    double("Asset").tap do |asset|
      allow(asset).to receive(:name=)
      allow(asset).to receive(:type=)
      allow(asset).to receive(:image_asset=)
    end
  end

  def mock_image_asset_resource
    double("ImageAsset").tap do |img|
      allow(img).to receive(:data=)
      allow(img).to receive(:file_size=)
      allow(img).to receive(:mime_type=)
      allow(img).to receive(:full_size=)
    end
  end

  def mock_image_dimension_resource
    double("ImageDimension").tap do |dim|
      allow(dim).to receive(:width_pixels=)
      allow(dim).to receive(:height_pixels=)
    end
  end

  def mock_campaign_asset_resource
    double("CampaignAsset").tap do |ca|
      allow(ca).to receive(:campaign=)
      allow(ca).to receive(:asset=)
      allow(ca).to receive(:field_type=)
    end
  end

  def mock_search_response_with_callout_asset(
    asset_id: 88888,
    customer_id: 456,
    callout_text: "Free Shipping"
  )
    callout_asset = double("CalloutAsset", callout_text: callout_text)

    asset = double("Asset",
      resource_name: "customers/#{customer_id}/assets/#{asset_id}",
      id: asset_id,
      callout_asset: callout_asset)

    row = double("GoogleAdsRow", asset: asset)
    [row]
  end

  def mock_callout_asset_resource
    double("CalloutAsset").tap do |ca|
      allow(ca).to receive(:callout_text=)
    end
  end

  def mock_asset_with_callout_resource
    double("Asset").tap do |asset|
      allow(asset).to receive(:callout_asset=)
    end
  end

  def mock_search_response_with_structured_snippet_asset(
    asset_id: 88888,
    customer_id: 456,
    header: "Services",
    values: []
  )
    snippet_asset = double("StructuredSnippetAsset",
      header: header,
      values: values)

    asset = double("Asset",
      resource_name: "customers/#{customer_id}/assets/#{asset_id}",
      id: asset_id,
      structured_snippet_asset: snippet_asset)

    row = double("GoogleAdsRow", asset: asset)
    [row]
  end

  def mock_structured_snippet_asset_resource
    values_array = []
    double("StructuredSnippetAsset").tap do |snippet|
      allow(snippet).to receive(:header=)
      allow(snippet).to receive(:values).and_return(values_array)
    end
  end

  def mock_asset_with_structured_snippet_resource
    double("Asset").tap do |asset|
      allow(asset).to receive(:structured_snippet_asset=)
    end
  end

  def mock_customer_user_access_invitation_service
    @mock_customer_user_access_invitation_service = double("CustomerUserAccessInvitationService")
    allow(@mock_client).to receive(:service).and_return(
      double("Services",
        customer: @mock_customer_service,
        google_ads: @mock_google_ads_service,
        campaign_budget: @mock_campaign_budget_service,
        campaign: @mock_campaign_service,
        ad_group: @mock_ad_group_service,
        bidding_strategy: @mock_bidding_strategy_service,
        campaign_criterion: @mock_campaign_criterion_service,
        ad_group_criterion: @mock_ad_group_criterion_service,
        ad_group_ad: @mock_ad_group_ad_service,
        asset: @mock_asset_service,
        campaign_asset: @mock_campaign_asset_service,
        customer_user_access_invitation: @mock_customer_user_access_invitation_service)
    )
    @mock_customer_user_access_invitation_service
  end

  def mock_customer_user_access_invitation_resource
    double("CustomerUserAccessInvitation").tap do |invitation|
      allow(invitation).to receive(:email_address=)
      allow(invitation).to receive(:access_role=)
    end
  end

  def mock_mutate_customer_user_access_invitation_response(invitation_id: 12345, customer_id: 456)
    result = double("MutateCustomerUserAccessInvitationResult",
      resource_name: "customers/#{customer_id}/customerUserAccessInvitations/#{invitation_id}")
    double("MutateCustomerUserAccessInvitationResponse", result: result)
  end

  def mock_search_response_with_invitation(
    invitation_id: 12345,
    customer_id: 456,
    email_address: "test@example.com",
    access_role: :ADMIN,
    invitation_status: :PENDING,
    creation_date_time: "2024-01-01 00:00:00"
  )
    invitation = double("CustomerUserAccessInvitation",
      resource_name: "customers/#{customer_id}/customerUserAccessInvitations/#{invitation_id}",
      email_address: email_address,
      access_role: access_role,
      invitation_status: invitation_status,
      creation_date_time: creation_date_time)
    row = double("GoogleAdsRow",
      customer_user_access_invitation: invitation,
      customer_user_access: nil)
    [row]
  end

  def mock_search_response_with_user_access(
    user_access_id: 67890,
    customer_id: 456,
    email_address: "test@example.com",
    access_role: :ADMIN,
    access_creation_date_time: "2024-01-01 00:00:00"
  )
    user_access = double("CustomerUserAccess",
      resource_name: "customers/#{customer_id}/customerUserAccess/#{user_access_id}",
      email_address: email_address,
      access_role: access_role,
      access_creation_date_time: access_creation_date_time)
    row = double("GoogleAdsRow",
      customer_user_access: user_access,
      customer_user_access_invitation: nil)
    [row]
  end
end

RSpec.configure do |config|
  config.include GoogleAdsMocks
end
