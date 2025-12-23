module AdGroupConcerns
  module CollectionSync
    extend ActiveSupport::Concern

    def keywords_syncer
      @keywords_syncer ||= GoogleAds::Keywords.new(self)
    end

    def sync_keywords
      keywords_syncer.sync
    end

    def keywords_synced?
      keywords_syncer.synced?
    end
  end
end
