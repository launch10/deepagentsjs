module CampaignConcerns::GoogleSyncable
  extend ActiveSupport::Concern

  def to_google_json
    GoogleAds::Resources::Campaign.new(self).to_google_json
  end

  def to_complete_google_json
    {
      campaign: to_google_json,
      schedules: ad_schedules.map(&:to_google_json),
      location_targets: location_targets.map(&:to_google_json),
      ad_groups: ad_groups.map(&:to_google_json),
      ads: ads.map(&:to_google_json),
      keywords: keywords.map(&:to_google_json),
      callouts: callouts.map(&:to_google_json),
      structured_snippets: structured_snippet&.to_google_json
    }
  end

  def sync_structured_snippets
    GoogleAds::Resources::StructuredSnippet.sync_all(self)
  end

  def structured_snippets_synced?
    GoogleAds::Resources::StructuredSnippet.synced?(self)
  end

  def structured_snippets_sync_plan
    GoogleAds::Resources::StructuredSnippet.sync_plan(self)
  end

  def sync_location_targets
    GoogleAds::Resources::LocationTarget.sync_all(self)
  end

  def location_targets_synced?
    GoogleAds::Resources::LocationTarget.synced?(self)
  end

  def location_targets_sync_plan
    GoogleAds::Resources::LocationTarget.sync_plan(self)
  end

  def google_syncer
    GoogleAds::Resources::Campaign.new(self)
  end

  def google_sync
    google_syncer.sync
  end

  def google_synced?
    google_syncer.synced?
  end

  def google_delete
    google_syncer.delete
  end

  def google_fetch
    google_syncer.fetch
  end

  def google_sync_result
    google_syncer.sync_result
  end

  def sync_ad_schedules
    GoogleAds::Resources::AdSchedule.sync_all(self)
  end

  def ad_schedules_synced?
    GoogleAds::Resources::AdSchedule.synced?(self)
  end

  def ad_schedules_sync_plan
    GoogleAds::Resources::AdSchedule.sync_plan(self)
  end

  def sync_ad_groups
    GoogleAds::Resources::AdGroup.sync_all(self)
  end

  def ad_groups_synced?
    GoogleAds::Resources::AdGroup.synced?(self)
  end

  def ad_groups_sync_plan
    GoogleAds::Resources::AdGroup.sync_plan(self)
  end

  def sync_budget
    GoogleAds::Resources::Budget.sync_all(self)
  end

  def budget_synced?
    GoogleAds::Resources::Budget.synced?(self)
  end

  def budget_sync_plan
    GoogleAds::Resources::Budget.sync_plan(self)
  end

  def sync_callouts
    GoogleAds::Resources::Callout.sync_all(self)
  end

  def callouts_synced?
    GoogleAds::Resources::Callout.synced?(self)
  end

  def callouts_sync_plan
    GoogleAds::Resources::Callout.sync_plan(self)
  end
end
