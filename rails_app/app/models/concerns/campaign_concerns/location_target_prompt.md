Let's create a GoogleAds::LocationTarget service like the GoogleAds::Budget and GoogleAds::Account services.

This is implement the Sync::Syncable interface.

We should ensure we establish the FIELD_MAPPINGS and use the GoogleMappable and GoogleSyncable modules in ad_location_target.rb to provide the sync functionality.

We should use the GoogleAdsMocks module to provide appropriate testing (ask me for clarity when you don't have particular mocks and I will provide them to you, so you are SURE you're implementing the correct functionality)

Start with red/green/refactor. We want to test the highest level of functionality first, then move down to the lower level details (let's start really just with ad_location_target.sync, ad_location_target.synced?, ad_location_target.sync_result)

- We currently ONLY support geo_location targets (not radius or location_group)

CampaignCriterionOperation.create:

- campaign: campaign
- location:
  - geo_target_constant: "geoTargetConstants/{criterionId}"
- negative: false (or true for excluded) # !ad_location_target.targeted
