module GoogleAds
  module Sync
    class CollectionSyncResult
      attr_reader :results

      def initialize(results:)
        @results = results
      end

      def success?
        results.all?(&:success?)
      end

      def synced?
        results.all? { |r| r.synced? || r.deleted? }
      end

      def created
        results.select(&:created?)
      end

      def updated
        results.select(&:updated?)
      end

      def unchanged
        results.select(&:unchanged?)
      end

      def deleted
        results.select(&:deleted?)
      end

      def errors
        results.select(&:error?)
      end

      def any_errors?
        errors.any?
      end

      def to_h
        {
          success: success?,
          synced: synced?,
          total: results.size,
          created: created.size,
          updated: updated.size,
          unchanged: unchanged.size,
          deleted: deleted.size,
          errors: errors.size,
          results: results.map(&:to_h)
        }
      end
    end
  end
end
