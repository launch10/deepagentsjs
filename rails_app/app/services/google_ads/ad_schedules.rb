module GoogleAds
  class AdSchedules < Sync::CollectionSyncable
    def campaign
      parent
    end

    private

    def active_records
      campaign.ad_schedules
    end

    def deleted_records
      ::AdSchedule.only_deleted.where(campaign_id: campaign.id)
    end

    def remote_id_for(record)
      record.google_criterion_id
    end
  end
end
