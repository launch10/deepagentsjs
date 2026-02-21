module TrackEvent
  extend self

  def call(event_name, **payload)
    ActiveSupport::Notifications.instrument("app_event.#{event_name}", payload)
  end
end
