# frozen_string_literal: true

class TurboFailureApp < Devise::FailureApp
  # Compatibility for Turbo::Native::Navigation
  class << self
    def helper_method(*methods)
    end
  end

  include Turbo::Native::Navigation

  # Intercept for Hotwire Native:
  # Return a 401 for any :authenticate_user before actions
  # Return a 422 for any login failures
  #
  # This param is set in a before_action on Devise controllers to ensure they don't return 401s
  def http_auth?
    (hotwire_native_app? && !params["hotwire_native_form"]) || super
  end
end

Devise.setup do |config|
  config.jwt do |jwt|
    # When building docker, allow this to be blank
    if Rails.application.credentials.devise_jwt_secret_key.present?
      jwt.secret = Rails.application.credentials.devise_jwt_secret_key!
    end
  end
  config.mailer_sender = Jumpstart.config.default_from_email
  config.parent_mailer = "ApplicationMailer"

  require "devise/orm/active_record"
  config.case_insensitive_keys = [:email]
  config.strip_whitespace_keys = [:email]
  config.skip_session_storage = [:http_auth]
  config.reload_routes = false
  config.stretches = Rails.env.test? ? 1 : 12
  config.send_password_change_notification = true
  config.allow_unconfirmed_access_for = 7.days
  config.reconfirmable = true
  config.expire_all_remember_me_on_sign_out = true
  config.password_length = 6..128
  config.email_regexp = /\A[^@\s]+@[^@\s]+\z/
  config.reset_password_within = 6.hours
  config.sign_in_after_reset_password = ->(user) { !user.otp_required_for_login? }
  config.sign_out_via = [:delete, :get]
  config.timeout_in = 1.day

  Jumpstart::Omniauth.enabled_providers.each do |provider, args|
    name = provider.to_s
    klass = OmniAuth.config.camelizations.fetch(name, name.classify)
    if Object.const_defined? "OmniAuth::Strategies::#{klass}"
      config.omniauth provider, args[:public_key], args[:private_key], args[:options]
    else
      Rails.logger.warn "Couldn't enable omniauth-#{provider} because the gem isn't loaded."
    end
  end

  config.omniauth :developer if Rails.env.test? && defined?(OmniAuth)

  config.warden do |manager|
    manager.failure_app = TurboFailureApp
  end
  config.responder.error_status = :unprocessable_entity
  config.responder.redirect_status = :see_other
end
