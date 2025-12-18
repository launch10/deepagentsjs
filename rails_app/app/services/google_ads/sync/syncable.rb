module GoogleAds
  module Sync
    class Syncable
      # Must return true/false
      def synced?
        raise "Not implemented error"
      end

      # Must return SyncResult
      def sync
        raise "Not implemented error"
      end

      # Must return SyncResult
      def sync_result
        raise "Not implemented error"
      end
    end
  end
end
