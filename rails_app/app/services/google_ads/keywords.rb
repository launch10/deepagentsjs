module GoogleAds
  class Keywords < Sync::CollectionSyncable
    def ad_group
      parent
    end

    def campaign
      ad_group.campaign
    end

    private

    def active_records
      # Query directly to avoid cached association returning soft-deleted records
      ::AdKeyword.where(ad_group_id: ad_group.id)
    end

    def deleted_records
      ::AdKeyword.only_deleted.where(ad_group_id: ad_group.id)
    end

    def remote_id_for(record)
      record.google_criterion_id
    end
  end
end
