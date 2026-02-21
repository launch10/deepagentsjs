Rails.application.config.after_initialize do
  PosthogSubscriber.subscribe!
end
