# frozen_string_literal: true

module Tracking
  class EventWorker
    include Sidekiq::Worker

    sidekiq_options queue: :default, retry: 5

    sidekiq_retry_in do |count|
      [1, 5, 30, 120, 300][count] || 300
    end

    def perform(visit_id, name, properties = {}, time = nil)
      visit = Ahoy::Visit.find(visit_id)

      visit.events.create!(
        name: name,
        properties: properties || {},
        time: time ? Time.parse(time) : Time.current
      )
    end
  end
end
