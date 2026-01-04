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

      # ─────────────────────────────────────────────────────────────
      # sync_plan - dry run planning for the entire collection
      #
      # Returns a Plan showing what sync() WOULD do:
      # 1. Deleted records with remote IDs → :delete operations
      # 2. Active records → delegated to their individual sync_plan
      # ─────────────────────────────────────────────────────────────

      def sync_plan
        operations = []

        # Plan deletions for soft-deleted records that have remote IDs
        deleted_records.each do |record|
          if remote_id_for(record).present?
            operations << {
              action: :delete,
              record: record,
              criterion_id: remote_id_for(record)
            }
          end
        end

        # Plan syncs for active records
        active_records.each do |record|
          record_plan = record.google_sync_plan
          operations.concat(record_plan.operations)
        end

        Plan.new(operations)
      end

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
