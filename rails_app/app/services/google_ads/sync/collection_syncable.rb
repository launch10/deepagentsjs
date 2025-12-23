module GoogleAds
  module Sync
    class CollectionSyncable
      extend Memoist
      include TypeCheck

      attr_reader :parent

      def initialize(parent)
        @parent = parent
      end

      def client
        GoogleAds.client
      end

      def sync
        results = []

        deleted_records.each do |record|
          results << record.google_delete
        end

        active_records.each do |record|
          results << record.google_sync
        end

        CollectionSyncResult.new(results: results)
      end

      def synced?
        deleted_records.none? { |r| remote_id_for(r).present? } &&
          active_records.all?(&:google_synced?)
      end
      memoize :synced?

      def sync_result
        CollectionSyncResult.new(results: active_records.map(&:google_sync_result))
      end
      memoize :sync_result

      private

      def active_records
        raise NotImplementedError, "Subclasses must implement #active_records"
      end

      def deleted_records
        raise NotImplementedError, "Subclasses must implement #deleted_records"
      end

      def remote_id_for(record)
        raise NotImplementedError, "Subclasses must implement #remote_id_for"
      end

      def clear_memoization
        flush_cache(:synced?)
        flush_cache(:sync_result)
      end
    end
  end
end
