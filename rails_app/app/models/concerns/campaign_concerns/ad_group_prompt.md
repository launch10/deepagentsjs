Let's create a GoogleAds::AdGroup service like the GoogleAds::LocationTarget, GoogleAds::Budget, and GoogleAds::Account services.

This is implement the Sync::Syncable interface.

We should ensure we establish the FIELD_MAPPINGS and use the GoogleMappable and GoogleSyncable modules in AdGroup.rb to provide the sync functionality.

We should use the GoogleAdsMocks module to provide appropriate testing (ask me for clarity when you don't have particular mocks and I will provide them to you, so you are SURE you're implementing the correct functionality)

Start with red/green/refactor. We want to test the highest level of functionality first, then move down to the lower level details (let's start really just with campaign.sync, campaign.synced?, campaign.sync_result)

AdGroupOperation.create:

- name: {ad_group_name from Content page}
- campaign: {campaignResourceName}
- type: SEARCH_STANDARD
- status: PAUSED
- cpc_bid_micros: 1_000_000 (default $1, managed by Maximize Clicks)
