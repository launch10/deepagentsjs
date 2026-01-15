# Impersonation Fix

## Problem

When an admin impersonates a user in the Launch10 application, three issues prevent proper scoping:

1. **JWT contains wrong credentials**: The JWT cookie retains the admin's user ID and account ID. Since Langgraph uses the JWT to identify users, all API requests are scoped to the admin instead of the impersonated user.

2. **Session retains admin's account**: The `session[:account_id]` persists with the admin's account, causing `account_from_session` to return the wrong account.

3. **ActsAsTenant scoped incorrectly**: Because `Current.account` uses memoization (`||=`), it doesn't recalculate when impersonation begins, leaving ActsAsTenant scoped to the admin's account.

The result: any projects, brainstorms, or campaigns created while impersonating are incorrectly owned by the admin's account rather than the impersonated user's account.

## Solution

Update the impersonation controller to:

1. Set `session[:account_id]` to the impersonated user's account
2. Regenerate the JWT with the impersonated user's credentials
3. Display a banner indicating active impersonation with a stop button

## Implementation

### 1. JWT Helper Guard (`app/controllers/concerns/jwt_helpers.rb`)

Add a guard against nil accounts to prevent errors when users have no associated accounts.

```ruby
def refresh_jwt(account: nil)
  set_request_details
  return unless current_user

  account ||= Current.account
  return unless account  # Guard against nil account

  payload = {
    jti: current_user.jwt_payload["jti"],
    sub: current_user.id,
    account_id: account.id,
    exp: 24.hours.from_now.to_i,
    iat: Time.current.to_i
  }

  token = JWT.encode(payload, Rails.application.credentials.devise_jwt_secret_key!, "HS256")

  cookies[:jwt] = {
    value: token,
    httponly: true,
    secure: Rails.env.production?,
    same_site: :lax
  }
end
```

### 2. Impersonation Controller (`app/controllers/madmin/user/impersonates_controller.rb`)

Update session and JWT when starting/stopping impersonation.

```ruby
class Madmin::User::ImpersonatesController < Madmin::ApplicationController
  include JwtHelpers  # Required - Madmin doesn't inherit from main ApplicationController

  def create
    user = ::User.find(params[:user_id])
    impersonate_user(user)

    # Update session and JWT for impersonated user
    session[:account_id] = user.primary_account&.id
    refresh_jwt(account: user.primary_account)

    redirect_to main_app.root_path, status: :see_other
  end

  def destroy
    impersonated_user = current_user  # Save before stopping
    stop_impersonating_user

    # After stopping, current_user is the admin again
    session[:account_id] = current_user.primary_account&.id
    refresh_jwt(account: current_user.primary_account)

    redirect_to main_app.madmin_user_path(impersonated_user), status: :see_other
  end
end
```
