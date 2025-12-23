module GoogleSyncable
  extend ActiveSupport::Concern

  included do
    class_attribute :google_sync_callbacks, default: []
    class_attribute :google_collection_syncers, default: {}
  end

  class_methods do
    def use_google_sync(syncer_class)
      define_method(:google_syncer) do
        @google_syncer ||= syncer_class.new(self)
      end

      define_method(:google_synced?) do
        google_syncer.synced?
      end

      define_method(:google_sync_result) do
        google_syncer.sync_result
      end

      define_method(:google_sync) do
        result = google_syncer.sync
        run_after_google_sync_callbacks(result) if result.success?
        result
      end

      define_method(:google_delete) do
        result = google_syncer.delete
        run_after_google_sync_callbacks(result) if result.success?
        result
      end
    end

    def use_google_collection_sync(name, syncer_class)
      self.google_collection_syncers = google_collection_syncers.merge(name.to_sym => syncer_class)

      syncer_method = "#{name}_syncer"
      define_method(syncer_method) do
        syncer_class.new(self)
      end

      define_method("sync_#{name}") do
        send(syncer_method).sync
      end

      # e.g. location_targets_synced?
      define_method("#{name}_synced?") do
        send(syncer_method).synced?
      end

      # e.g. location_targets_sync_result
      define_method("#{name}_sync_result") do
        send(syncer_method).sync_result
      end
    end

    def after_google_sync(method_name = nil, &block)
      callback = method_name || block
      self.google_sync_callbacks = google_sync_callbacks + [callback]
    end
  end

  def run_after_google_sync_callbacks(result)
    self.class.google_sync_callbacks.each do |callback|
      if callback.is_a?(Symbol)
        send(callback, result)
      else
        instance_exec(result, &callback)
      end
    end
  end
end
