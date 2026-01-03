module GoogleAds
  class Callouts < Sync::CollectionSyncable
    def campaign
      parent
    end

    private

    def active_records
      # Query directly to avoid cached association returning soft-deleted records
      ::AdCallout.where(campaign_id: campaign.id)
    end

    def deleted_records
      ::AdCallout.only_deleted.where(campaign_id: campaign.id)
    end

    def remote_id_for(record)
      record.google_asset_id
    end
  end
end
