module GoogleAds
  class StructuredSnippets < Sync::CollectionSyncable
    def campaign
      parent
    end

    private

    def active_records
      campaign.structured_snippet ? [campaign.structured_snippet] : []
    end

    def deleted_records
      AdStructuredSnippet.only_deleted.where(campaign_id: campaign.id)
    end

    def remote_id_for(record)
      record.google_asset_id
    end
  end
end
