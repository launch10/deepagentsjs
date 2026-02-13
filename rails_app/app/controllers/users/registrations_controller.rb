class Users::RegistrationsController < Devise::RegistrationsController
  include InertiaConcerns

  layout "auth", only: [:new, :create]

  invisible_captcha only: :create
  rate_limit to: 10, within: 3.minutes, only: :create, with: -> { redirect_to new_user_registration_path, alert: "Try again later." }

  before_action :setup_captcha_session, only: [:new]

  inertia_share do
    flash_messages = []
    flash_messages << { type: "alert", message: flash[:alert] } if flash[:alert]
    flash_messages << { type: "notice", message: flash[:notice] } if flash[:notice]
    {
      flash: flash_messages,
      csrf_token: form_authenticity_token,
      google_oauth_path: google_oauth_enabled? ? user_google_oauth2_omniauth_authorize_path : nil,
      captcha_field_name: InvisibleCaptcha.honeypots.sample,
      minimum_password_length: resource_class.password_length.min,
      spinner: session[:invisible_captcha_spinner]
    }
  end

  def new
    render inertia: "Auth/SignUp"
  end

  def create
    build_resource(sign_up_params)
    resource.save

    if resource.persisted?
      if resource.active_for_authentication?
        set_flash_message!(:notice, :signed_up)
        sign_up(resource_name, resource)
        inertia_location after_sign_up_path_for(resource)
      else
        set_flash_message!(:notice, :"signed_up_but_#{resource.inactive_message}")
        expire_data_after_sign_in!
        inertia_location after_inactive_sign_up_path_for(resource)
      end
    else
      clean_up_passwords resource
      set_minimum_password_length
      setup_captcha_session
      render inertia: "Auth/SignUp", props: { errors: resource.errors.to_hash(true) }, status: :unprocessable_entity
    end
  end

  protected

  def build_resource(hash = {})
    self.resource = resource_class.new_with_session(hash, session)

    # Registering to accept an invitation should display the invitation on sign up
    if params[:invite] && (invite = AccountInvitation.find_by(token: params[:invite]))
      @account_invitation = invite

      # Use name/email from the invite if not already provided. Email defaults to "" so it must use a presence check.
      resource.name ||= invite.name
      resource.email = resource.email.presence || invite.email

    # Build and display account fields in registration form if needed
    elsif Jumpstart.config.register_with_account?
      account = resource.owned_accounts.first || resource.owned_accounts.new
      account.account_users.new(user: resource, admin: true)
    end
  end

  def update_resource(resource, params)
    # Jumpstart: Allow user to edit their profile without password
    resource.update_without_password(params)
  end

  def sign_up(resource_name, resource)
    super

    if defined?(Refer)
      refer(resource)

      if resource.respond_to?(:referral) && resource.referral.present?
        TrackEvent.call("referral_signup_completed",
          user: resource,
          account: resource.accounts.first,
          referrer_user_id: resource.referral.refer_code&.user_id,
          referral_code: resource.referral.refer_code&.code,
          referred_user_id: resource.id)
      end
    end

    if @account_invitation
      # Remove any default team accounts to make the invited account the default.
      current_user.accounts.where(personal: false).destroy_all
      @account_invitation.accept!(current_user)

      # Clear redirect to account invitation since it's already been accepted
      stored_location_for(:user)
    end
  end

  private

  def setup_captcha_session
    session[:invisible_captcha_timestamp] = Time.zone.now.iso8601
    session[:invisible_captcha_spinner] = InvisibleCaptcha.encode("#{session[:invisible_captcha_timestamp]}-#{request.remote_ip}")
  end

  def google_oauth_enabled?
    Jumpstart::Omniauth.enabled?("google-oauth2")
  end
end
