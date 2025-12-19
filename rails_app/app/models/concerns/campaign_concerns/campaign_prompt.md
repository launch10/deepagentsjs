Let's create a GoogleAds::Campaign service like the GoogleAds::Budget and GoogleAds::Account services.

This is implement the Sync::Syncable interface.

We should ensure we establish the FIELD_MAPPINGS and use the GoogleMappable and GoogleSyncable modules in Campaign.rb to provide the sync functionality.

We should use the GoogleAdsMocks module to provide appropriate testing (ask me for clarity when you don't have particular mocks and I will provide them to you, so you are SURE you're implementing the correct functionality)

Start with red/green/refactor. We want to test the highest level of functionality first, then move down to the lower level details (let's start really just with campaign.sync, campaign.synced?, campaign.sync_result)

CampaignOperation.create:

- name: campaign.name
- advertising_channel_type: campaign.google_advertising_channel_type
- status: campaign.google_status
- campaign_budget: campaign.ad_budget.google_budget_id # Or however we have to link this
- start_date: campaign.ad_scheule.start_date
- end_date: campaign.ad_scheule.end_date
- maximize_clicks: {} campaign.google_bidding_strategy
- network_settings: # See campaign_concerns/google_platform_settings.rb
  - target_google_search: true
  - target_search_network: true
  - target_content_network: false
