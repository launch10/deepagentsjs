module GoogleSyncable
  extend ActiveSupport::Concern

  class_methods do
    def use_google_sync(syncer_class)
      define_method(:google_syncer) do
        @google_syncer ||= syncer_class.new(campaign)
      end

      define_method(:google_synced?) do
        google_syncer.synced?
      end

      define_method(:google_sync_result) do
        google_syncer.sync_result
      end

      define_method(:google_sync) do
        google_syncer.sync
      end
    end
  end
end
