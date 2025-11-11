Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = ENV["CI"].present?
  config.public_file_server.headers = {"cache-control" => "public, max-age=3600"}
  config.consider_all_requests_local = true
  config.cache_store = :null_store
  config.action_dispatch.show_exceptions = :rescuable
  config.action_controller.allow_forgery_protection = false
  config.active_storage.service = :test
  config.action_mailer.delivery_method = :test
  config.action_mailer.default_url_options = {host: "localhost", port: 3000}
  config.active_support.deprecation = :stderr
  config.log_level = :debug
  config.active_record.verbose_query_logs = true
  config.action_controller.logger = ActiveSupport::Logger.new($stdout)
  config.active_record.query_log_tags_enabled = true
  config.i18n.raise_on_missing_translations = true
  config.action_controller.raise_on_missing_callback_actions = true
  config.require_master_key = true
  config.hosts = nil
  config.stretches = 1
  config.active_record.encryption.encrypt_fixtures = true
  config.active_job.queue_adapter = :test
end
