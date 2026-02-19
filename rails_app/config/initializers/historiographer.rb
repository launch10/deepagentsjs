# config/initializers/historiographer.rb
Historiographer::Configuration.configure do |config|
  config.error_notifier = ->(message) { Sentry.capture_message(message) }
end
