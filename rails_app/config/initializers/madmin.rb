Madmin.site_name = Jumpstart.config.application_name

Madmin.menu.before_render do
  add label: "Sidekiq", url: Rails.application.routes.url_helpers.madmin_sidekiq_web_path, position: 1 if defined? ::Sidekiq::Web
  add label: "Models", url: Rails.application.routes.url_helpers.madmin_models_path, position: 2
  add label: "Users & Accounts", position: 3
  add label: "Payments", position: 4
  add label: "Resources", position: 5
end
