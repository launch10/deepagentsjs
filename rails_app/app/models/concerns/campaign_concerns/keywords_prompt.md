Let's create a GoogleAds::Keyword service like the GoogleAds::LocationTarget, GoogleAds::Budget, and GoogleAds::Account services.

This is implement the Sync::Syncable interface.

We should ensure we establish the FIELD_MAPPINGS and use the GoogleMappable and GoogleSyncable modules in AdKeyword.rb to provide the sync functionality.

We should use the GoogleAdsMocks module to provide appropriate testing (ask me for clarity when you don't have particular mocks and I will provide them to you, so you are SURE you're implementing the correct functionality)

Start with red/green/refactor. We want to test the highest level of functionality first, then move down to the lower level details (let's start really just with campaign.sync, campaign.synced?, campaign.sync_result)

AdGroupCriterionOperation.create:

- ad_group: {adGroupResourceName}
- keyword:
  - text: keyword.text
  - match_type: {keyword.match_type}
- status: ENABLED

after create => sync google_criterion_id

Update(spec/support/google_ads_mocks.rb)
⎿  Updated spec/support/google_ads_mocks.rb with 54 additions and 1 removal
8 @mock_ad_group_service = double("AdGroupService")
9 @mock_bidding_strategy_service = double("BiddingStrategyService")
10 @mock_campaign_criterion_service = double("CampaignCriterionService")
11 + @mock_ad_group_criterion_service = double("AdGroupCriterionService")
12 @mock_operation = double("Operation")
13 @mock_create_resource = double("CreateResource")
14 @mock_update_resource = double("UpdateResource")
...
19 campaign: @mock_campaign_service,
20 ad_group: @mock_ad_group_service,
21 bidding_strategy: @mock_bidding_strategy_service,
22 - campaign_criterion: @mock_campaign_criterion_service
22 + campaign_criterion: @mock_campaign_criterion_service,
23 + ad_group_criterion: @mock_ad_group_criterion_service
24 )
25
26 allow(GoogleAds).to receive(:client).and_return(@mock_client)
...
407 allow(criterion).to receive(:bid_modifier=)
408 end
409 end
410 +
411 + def mock_search_response_with_keyword(
412 + criterion_id: 333,
413 + ad_group_id: 999,
414 + customer_id: 456,
415 + keyword_text: "test keyword",
416 + match_type: :BROAD,
417 + status: :ENABLED,
418 + cpc_bid_micros: nil,
419 + negative: false
420 + )
421 + keyword = double("KeywordInfo",
422 + text: keyword_text,
423 + match_type: match_type
424 + )
425 + criterion = double("AdGroupCriterion",
426 + resource_name: "customers/#{customer_id}/adGroupCriteria/#{ad_group_id}~#{criterion_id}",
427 + criterion_id: criterion_id,
428 + ad_group: "customers/#{customer_id}/adGroups/#{ad_group_id}",
429 + keyword: keyword,
430 + status: status,
431 + cpc_bid_micros: cpc_bid_micros,
432 + negative: negative
433 + )
434 + row = double("GoogleAdsRow", ad_group_criterion: criterion)
435 + [row]
436 + end
437 +
438 + def mock_mutate_ad_group_criterion_response(criterion_id: 333, ad_group_id: 999, customer_id: 456)
439 + result = double("MutateAdGroupCriterionResult",
440 + resource_name: "customers/#{customer_id}/adGroupCriteria/#{ad_group_id}~#{criterion_id}"
441 + )
442 + double("MutateAdGroupCriteriaResponse", results: [result])
443 + end
444 +
445 + def mock_ad_group_criterion_resource
446 + double("AdGroupCriterion").tap do |criterion|
447 + allow(criterion).to receive(:ad_group=)
448 + allow(criterion).to receive(:keyword=)
449 + allow(criterion).to receive(:status=)
450 + allow(criterion).to receive(:cpc_bid_micros=)
451 + allow(criterion).to receive(:negative=)
452 + end
453 + end
454 +
455 + def mock_keyword_info_resource
456 + double("KeywordInfo").tap do |keyword|
457 + allow(keyword).to receive(:text=)
458 + allow(keyword).to receive(:match_type=)
459 + end
460 + end
461 end
