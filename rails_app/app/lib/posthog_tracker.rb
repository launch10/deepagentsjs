class PosthogTracker
  class << self
    def capture(user_or_id, event, properties = {})
      distinct_id = user_or_id.is_a?(User) ? user_or_id.id.to_s : user_or_id.to_s
      PosthogTrackWorker.perform_async(distinct_id, event, properties.deep_stringify_keys)
    end

    def identify(user, properties = {})
      return unless POSTHOG

      POSTHOG.identify(
        distinct_id: user.id.to_s,
        properties: {
          email: user.email,
          name: user.name
        }.merge(properties)
      )
    rescue => e
      Rails.logger.error("PosthogTracker.identify failed: #{e.message}")
    end
  end
end
