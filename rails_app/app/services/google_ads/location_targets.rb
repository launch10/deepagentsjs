module GoogleAds
  class LocationTargets < Sync::CollectionSyncable
    def campaign
      parent
    end

    private

    def active_records
      # Query directly to avoid cached association returning soft-deleted records
      ::AdLocationTarget.where(campaign_id: campaign.id)
    end

    def deleted_records
      ::AdLocationTarget.only_deleted.where(campaign_id: campaign.id)
    end

    def remote_id_for(record)
      record.google_remote_criterion_id
    end
  end
end
