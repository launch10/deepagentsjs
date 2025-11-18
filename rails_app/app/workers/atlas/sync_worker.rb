# frozen_string_literal: true

module Atlas
  class SyncWorker
    include Sidekiq::Worker

    sidekiq_options queue: :critical, retry: 5

    def perform(class_name, id, method_name)
      model_class = class_name.constantize
      record = model_class.find(id)
      record.send(method_name)
    rescue NoMethodError => e
      Rails.logger.error "[Atlas::SyncJob] Invalid method: #{method_name} for #{class_name}##{id} - #{e.message}"
    rescue ActiveRecord::RecordNotFound => e
      Rails.logger.warn "[Atlas::SyncJob] Record not found: #{class_name}##{id} - #{e.message}"
    rescue NameError => e
      Rails.logger.error "[Atlas::SyncJob] Invalid class name: #{class_name} - #{e.message}"
    end
  end
end
