module GoogleAds
  class LocationTargets < Sync::CollectionSyncable
    def campaign
      parent
    end

    private

    def active_records
      campaign.location_targets
    end

    def deleted_records
      ::AdLocationTarget.only_deleted.where(campaign_id: campaign.id)
    end

    def remote_id_for(record)
      record.google_remote_criterion_id
    end
  end
end
