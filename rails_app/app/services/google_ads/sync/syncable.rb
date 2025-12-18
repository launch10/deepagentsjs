module GoogleAds
  module Sync
    class Syncable
      extend Memoist
      include TypeCheck

      attr_reader :campaign
      def initialize(campaign)
        @campaign = expect_type(campaign, Campaign)
      end

      def synced?
        sync_result.synced?
      end
      memoize :synced?

      def sync
        raise "Not implemented error"
      end

      def sync_result
        raise "Not implemented error"
      end
      memoize :sync_result

      def not_found_result(resource_type)
        expect_type(resource_type, Symbol)

        SyncResult.new(
          resource_type: resource_type,
          action: :not_found,
          comparisons: []
        )
      end

      def error_result(resource_type, error)
        expect_type(resource_type, Symbol)
        expect_type(error, StandardError)

        SyncResult.new(
          resource_type: resource_type,
          action: :error,
          comparisons: [],
          error: error
        )
      end
    end
  end
end
