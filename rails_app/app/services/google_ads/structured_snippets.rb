module GoogleAds
  class StructuredSnippets < Sync::CollectionSyncable
    def campaign
      parent
    end

    private

    def active_records
      # Query directly to avoid cached association returning soft-deleted records
      snippet = ::AdStructuredSnippet.where(campaign_id: campaign.id).first
      snippet ? [snippet] : []
    end

    def deleted_records
      ::AdStructuredSnippet.only_deleted.where(campaign_id: campaign.id)
    end

    def remote_id_for(record)
      record.google_asset_id
    end
  end
end
