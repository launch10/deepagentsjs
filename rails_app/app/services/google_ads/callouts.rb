module GoogleAds
  class Callouts < Sync::CollectionSyncable
    def campaign
      parent
    end

    private

    def active_records
      campaign.callouts
    end

    def deleted_records
      AdCallout.only_deleted.where(campaign_id: campaign.id)
    end

    def remote_id_for(record)
      record.google_asset_id
    end
  end
end
