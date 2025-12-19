Let's create a GoogleAds::Ad service like the GoogleAds::LocationTarget, GoogleAds::Budget, and GoogleAds::Account services.

This is implement the Sync::Syncable interface.

We should ensure we establish the FIELD_MAPPINGS and use the GoogleMappable and GoogleSyncable modules in Ad.rb to provide the sync functionality.

We should use the GoogleAdsMocks module to provide appropriate testing (ask me for clarity when you don't have particular mocks and I will provide them to you, so you are SURE you're implementing the correct functionality)

Start with red/green/refactor. We want to test the highest level of functionality first, then move down to the lower level details (let's start really just with campaign.sync, campaign.synced?, campaign.sync_result)

Important notes:

- Unlike the rest of our assets, AdHeadline and AdDescription are not their own resources. They are part of the AdGroupAdOperation.create
  - Do not create any GoogleSyncable modules for AdHeadline or AdDescription
  - Do not create any GoogleMappable modules for AdHeadline or AdDescription (unless you decide this is the best pattern)
  - Do not create any FIELD_MAPPINGS for AdHeadline or AdDescription (unless you decide this is the best pattern)
  - Put everything in the Ad.rb model, unless you decide upon a better pattern

AdGroupAdOperation.create:

- ad_group: {adGroupResourceName}
- ad:
  - final_urls: ["{landing_page_url}"]
  - responsive_search_ad:
    - headlines: [{ text: "...", pinned_field: HEADLINE_1 (if locked) }, ...]
    - descriptions: [{ text: "..." }, ...]
    - path1: "{optional}"
    - path2: "{optional}"
- status: PAUSED

after create => sync google_ad_id

AdGroupAdOperation.create:

- ad_group: {adGroupResourceName}
- ad:
  - final_urls: ["{landing_page_url}"]
  - responsive_search_ad:
    - headlines: [{ text: "...", pinned_field: HEADLINE_1 (if locked) }, ...]
    - descriptions: [{ text: "..." }, ...]
    - path1: "{optional}"
    - path2: "{optional}"
- status: PAUSED
