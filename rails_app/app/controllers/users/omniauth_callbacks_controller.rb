class Users::OmniauthCallbacksController < Devise::OmniauthCallbacksController
  include Jumpstart::Omniauth::Callbacks

  # Jumpstart Pro's Callbacks module handles:
  #
  #   1. Registering with OAuth
  #   2. Connecting OAuth when logged in
  #   3. Logging in with OAuth
  #   4. Rejecting OAuth if user already has account, but hasn't connected this OAuth account yet

  # For extra processing on the account that was just connected,
  # simply define a method like the following examples:
  #
  # def github_connected(connected_account)
  # end
  #
  # def twitter_connected(connected_account)
  # end
  #
  # etc...

  # Complete GoogleOAuthConnect job run when user connects Google OAuth.
  # This is called by Jumpstart's Omniauth::Callbacks module after a successful connection.
  #
  # We find the job run through the active deploy to avoid race conditions when
  # multiple deploys exist. The flow:
  # 1. Find the most recently active deploy (user_active_at within last 10 minutes)
  # 2. Find the pending/running GoogleOAuthConnect job for that deploy
  def google_oauth2_connected(connected_account)
    continue_active_deploy!
  end

  def account
    @account ||= connected_account.owner.owned_account
  end

  private

  def continue_active_deploy!
    return unless account

    # Users that signup in the traditional signup flow wouldn't have deploys
    user_has_any_project = account.projects.limit(1).exists?
    return unless user_has_any_project

    # Find the most recently active deploy across all account projects
    # This is the deploy the user was working on when they clicked "Connect with Google"
    active_deploy = Deploy.joins(project: :account)
      .where(projects: { account_id: account.id })
      .in_progress
      .user_recently_active
      .order(user_active_at: :desc)
      .first

    # Find job run through deploy if available, fall back to account-level lookup
    job_run = if active_deploy
      active_deploy.job_runs
        .where(job_class: "GoogleOAuthConnect", status: %w[pending running])
        .order(created_at: :desc)
        .first
    else
      # Legacy fallback: find by account if no active deploy
      account.job_runs
        .where(job_class: "GoogleOAuthConnect", status: %w[pending running])
        .order(created_at: :desc)
        .first
    end

    return unless job_run

    job_run.complete!({ google_email: connected_account.email })
    job_run.notify_langgraph(status: "completed", result: { google_email: connected_account.email })
  end

  # To change the redirect URL after an account is connected, you can override the following methods:
  #
  # After sign up and sign in with OAuth
  # def after_sign_in_path_for(resource)
  #   root_path
  # end
  #
  # After connecting an OAuth account while logged in
  # def after_connect_redirect_path(connected_account)
  #   request.env['omniauth.origin'] || user_connected_accounts_path
  # end
end
