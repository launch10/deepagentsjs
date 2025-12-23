module CampaignConcerns
  module CollectionSync
    extend ActiveSupport::Concern

    def location_targets_syncer
      @location_targets_syncer ||= GoogleAds::LocationTargets.new(self)
    end

    def sync_location_targets
      location_targets_syncer.sync
    end

    def location_targets_synced?
      location_targets_syncer.synced?
    end

    def ad_schedules_syncer
      @ad_schedules_syncer ||= GoogleAds::AdSchedules.new(self)
    end

    def sync_ad_schedules
      ad_schedules_syncer.sync
    end

    def ad_schedules_synced?
      ad_schedules_syncer.synced?
    end

    def callouts_syncer
      @callouts_syncer ||= GoogleAds::Callouts.new(self)
    end

    def sync_callouts
      callouts_syncer.sync
    end

    def callouts_synced?
      callouts_syncer.synced?
    end

    def structured_snippets_syncer
      @structured_snippets_syncer ||= GoogleAds::StructuredSnippets.new(self)
    end

    def sync_structured_snippets
      structured_snippets_syncer.sync
    end

    def structured_snippets_synced?
      structured_snippets_syncer.synced?
    end
  end
end
