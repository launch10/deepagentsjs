Let's create a GoogleAds::AdSchedule service like the GoogleAds::LocationTarget, GoogleAds::Budget, and GoogleAds::Account services.

This is implement the Sync::Syncable interface.

We should ensure we establish the FIELD_MAPPINGS and use the GoogleMappable and GoogleSyncable modules in AdSchedule.rb to provide the sync functionality.

We should use the GoogleAdsMocks module to provide appropriate testing (ask me for clarity when you don't have particular mocks and I will provide them to you, so you are SURE you're implementing the correct functionality)

Start with red/green/refactor. We want to test the highest level of functionality first, then move down to the lower level details (let's start really just with campaign.sync, campaign.synced?, campaign.sync_result)

CampaignCriterionOperation.create:

- campaign: {campaignResourceName}
- ad_schedule:
  - day_of_week: {MONDAY, TUESDAY, etc.}
  - start_hour: {0-23}
  - start_minute: {ZERO, FIFTEEN, THIRTY, FORTY_FIVE}
  - end_hour: {0-24}
  - end_minute: {ZERO, FIFTEEN, THIRTY, FORTY_FIVE}
