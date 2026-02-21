class PosthogTrackWorker < ApplicationWorker
  sidekiq_options queue: "default", retry: 3

  def perform(distinct_id, event, properties = {})
    return unless POSTHOG

    POSTHOG.capture(distinct_id: distinct_id, event: event, properties: properties)
  end
end
