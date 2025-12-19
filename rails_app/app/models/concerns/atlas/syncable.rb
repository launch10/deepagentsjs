# frozen_string_literal: true

module Atlas
  module Syncable
    extend ActiveSupport::Concern

    included do
      after_create_commit :enqueue_sync_to_atlas_on_create
      after_update_commit :enqueue_sync_to_atlas_on_update, if: :sync_to_atlas_required?
      before_destroy :enqueue_sync_to_atlas_on_destroy
    end

    def sync_to_atlas
      sync_to_atlas_on_create
    end

    private

    def enqueue_sync_to_atlas_on_create
      return unless atlas_sync_enabled?

      Atlas::SyncWorker.perform_async(self.class.name, id, "sync_to_atlas_on_create")
    end

    def enqueue_sync_to_atlas_on_update
      return unless atlas_sync_enabled?

      Atlas::SyncWorker.perform_async(self.class.name, id, "sync_to_atlas_on_update")
    end

    def enqueue_sync_to_atlas_on_destroy
      return unless atlas_sync_enabled?

      Atlas::SyncWorker.perform_async(self.class.name, id, "sync_to_atlas_on_destroy")
    end

    def sync_to_atlas_on_create
      return unless atlas_sync_enabled?

      atlas_service.create(**atlas_data_for_create.merge!(id: atlas_identifier))
    rescue Atlas::BaseService::Error => e
      Rails.logger.error "[Atlas] Failed to sync #{self.class.name} ##{id} on create: #{e.message}"
    end

    def sync_to_atlas_on_update
      return unless atlas_sync_enabled?

      atlas_service.update(atlas_identifier, **atlas_data_for_update.merge!(id: atlas_identifier))
    rescue Atlas::BaseService::Error => e
      Rails.logger.error "[Atlas] Failed to sync #{self.class.name} ##{id} on update: #{e.message}"
    end

    def sync_to_atlas_on_destroy
      return unless atlas_sync_enabled?

      atlas_service.destroy(atlas_identifier)
    rescue Atlas::BaseService::NotFoundError => e
      Rails.logger.warn "[Atlas] #{self.class.name} ##{id} not found in Atlas, may have been already deleted: #{e.message}"
    rescue Atlas::BaseService::Error => e
      Rails.logger.error "[Atlas] Failed to delete #{self.class.name} ##{id} from Atlas: #{e.message}"
    end

    def atlas_sync_enabled?
      Rails.application.credentials.dig(:atlas, :api_secret).present?
    end

    def sync_to_atlas_required?
      # Override in including class to define when sync is required
      true
    end

    def atlas_service
      # Override in including class to return the appropriate service
      raise NotImplementedError, "#{self.class.name} must implement atlas_service"
    end

    def atlas_data_for_create
      # Override in including class to return data for create
      raise NotImplementedError, "#{self.class.name} must implement atlas_data_for_create"
    end

    def atlas_data_for_update
      # Override in including class to return data for update
      atlas_data_for_create
    end

    def atlas_identifier
      id
    end
  end
end
