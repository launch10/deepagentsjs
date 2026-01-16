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

Note: `User#primary_account` is defined in `app/models/user/accounts.rb`.

### 3. Admin Inertia Share (`app/controllers/madmin/application_controller.rb`)

Add impersonation props to the Inertia share block.

```ruby
module Madmin
  class ApplicationController < Madmin::BaseController
    include Devise::Controllers::Helpers

    before_action :authenticate_admin_user
    around_action :without_tenant if defined? ActsAsTenant

    impersonates :user

    inertia_share do
      {
        current_user: current_user&.slice(:id, :name, :email),
        true_user: true_user&.slice(:id, :name, :email),
        impersonating: current_user && true_user && current_user.id != true_user.id
      }
    end

    # ... existing methods ...
  end
end
```

### 4. Main App Inertia Share (`app/controllers/subscribed_controller.rb`)

Add impersonation props to the existing Inertia share block. The `true_user` method is available via the Authentication concern which includes Pretender.

```ruby
class SubscribedController < ApplicationController
  # ... existing code ...

  inertia_share do
    {
      root_path: root_path,
      langgraph_path: langgraph_path,
      jwt: cookies[:jwt],
      errors: session.delete(:errors) || {},
      flash: flash_messages,
      current_user: current_user&.slice(:id, :name, :email),
      true_user: true_user&.slice(:id, :name, :email),
      impersonating: current_user && true_user && current_user.id != true_user.id
    }
  end

  # ... existing methods ...
end
```

### 5. Impersonation Banner Component (`app/javascript/frontend/components/shared/ImpersonationBanner.tsx`)

Create a new component that displays when impersonation is active.

```tsx
import { router, usePage } from "@inertiajs/react";

export default function ImpersonationBanner() {
  const { current_user, impersonating } = usePage().props as any;

  if (!impersonating || !current_user) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-sm flex items-center justify-center gap-4">
      <span>
        Impersonating <strong>{current_user.name || current_user.email}</strong>
      </span>
      <button
        onClick={() => router.delete(`/admin/users/${current_user.id}/impersonate`)}
        className="bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded text-xs font-medium transition-colors"
      >
        Stop Impersonating
      </button>
    </div>
  );
}
```

### 6. Admin Header (`app/javascript/frontend/components/shared/header/AdminHeader.tsx`)

Add the banner above the header.

```tsx
import ImpersonationBanner from "../ImpersonationBanner";
// ... existing imports ...

export default function AdminHeader() {
  // ... existing code ...

  return (
    <>
      <ImpersonationBanner />
      <header className="bg-background py-3 sticky top-0 z-10 border-b border-border">
        {/* ... existing header content ... */}
      </header>
    </>
  );
}
```

### 7. Main Header (`app/javascript/frontend/components/shared/header/Header.tsx`)

Add the banner above the header.

```tsx
import ImpersonationBanner from "../ImpersonationBanner";
// ... existing imports ...

export default function Header() {
  return (
    <>
      <ImpersonationBanner />
      <header className="bg-background py-5 sticky top-0 z-10 relative">
        {/* ... existing header content ... */}
      </header>
    </>
  );
}
```

## Testing

### Request Specs (`spec/requests/madmin/user/impersonates_spec.rb`)

```ruby
RSpec.describe "Madmin::User::Impersonates", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:target_user) { create(:user) }

  before { sign_in admin }

  describe "POST /admin/users/:user_id/impersonate" do
    it "sets the session account_id to the target user's account" do
      post madmin_user_impersonate_path(target_user)
      expect(session[:account_id]).to eq(target_user.primary_account.id)
    end

    it "regenerates the JWT with the target user's credentials" do
      post madmin_user_impersonate_path(target_user)
      jwt_payload = decode_jwt(cookies[:jwt])
      expect(jwt_payload["sub"]).to eq(target_user.id)
      expect(jwt_payload["account_id"]).to eq(target_user.primary_account.id)
    end
  end

  describe "DELETE /admin/users/:user_id/impersonate" do
    before { post madmin_user_impersonate_path(target_user) }

    it "restores the admin's JWT" do
      delete madmin_user_impersonate_path(target_user)
      jwt_payload = decode_jwt(cookies[:jwt])
      expect(jwt_payload["sub"]).to eq(admin.id)
    end

    it "restores the admin's session account_id" do
      delete madmin_user_impersonate_path(target_user)
      expect(session[:account_id]).to eq(admin.primary_account.id)
    end
  end

  private

  def decode_jwt(jwt)
    JWT.decode(jwt, Rails.application.credentials.devise_jwt_secret_key, true, algorithm: "HS256").first
  end
end
```

### E2E Test (`e2e/impersonation.spec.ts`)

This test verifies the full cross-platform integration between Rails and Langgraph.

```typescript
import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { BrainstormPage } from "./pages/brainstorm.page";

const adminUser = {
  email: "admin@launch10.ai",
  password: "AdminTestPass!",
};

test.describe("Admin Impersonation", () => {
  test.setTimeout(120000); // Brainstorm flow takes time

  test("impersonated brainstorm is visible to real user", async ({ page }) => {
    // 1. Restore snapshot with admin + test user
    await DatabaseSnapshotter.restoreSnapshot("admin_with_test_user");

    // 2. Login as admin
    await loginUser(page, adminUser.email, adminUser.password);

    // 3. Navigate to admin panel and impersonate test user
    await page.goto("/admin/users");
    await page.waitForLoadState("domcontentloaded");

    // Find and click impersonate on test_user@launch10.ai
    const userRow = page.locator("tr", { hasText: "test_user@launch10.ai" });
    await userRow.getByRole("link", { name: "Impersonate" }).click();

    // 4. Verify impersonation banner is visible
    await expect(page.locator("text=Impersonating")).toBeVisible();
    await expect(page.locator("text=Stop Impersonating")).toBeVisible();

    // 5. Start a brainstorm (creates project scoped to impersonated user)
    const brainstormPage = new BrainstormPage(page);
    await brainstormPage.sendMessage("I want to start a pet grooming business for cats");

    // Wait for URL to update with project ID
    await page.waitForFunction(
      () => window.location.href.includes("/projects/"),
      { timeout: 10000 }
    );

    // Wait for AI response (ensures project is persisted)
    await brainstormPage.waitForResponse();

    // Get the project URL for later
    const projectUrl = page.url();
    const projectUuid = brainstormPage.getThreadIdFromUrl();
    expect(projectUuid).not.toBeNull();

    // 6. Stop impersonating (click button in banner)
    await page.getByRole("button", { name: "Stop Impersonating" }).click();

    // Should redirect to admin panel
    await page.waitForURL("**/admin/users/**");

    // 7. Logout admin
    await page.goto("/users/sign_out", { waitUntil: "domcontentloaded" });

    // 8. Login as the real test user
    await loginUser(page, "test_user@launch10.ai", "Launch10TestPass!");

    // 9. Navigate directly to the project URL
    await page.goto(projectUrl);
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

    // 10. Verify the project and brainstorm messages are visible
    const messageCount = await brainstormPage.getUserMessageCount();
    expect(messageCount).toBeGreaterThan(0);

    // Verify the original message is there
    await expect(page.locator("text=pet grooming business for cats")).toBeVisible();
  });
});
```

### Database Snapshot Requirements

Create `db/snapshots/admin_with_test_user.sql` containing:
- Admin user (`admin@launch10.ai`, `admin: true`)
- Regular test user (`test_user@launch10.ai`)
- Both users must have accounts and subscriptions

## Verification

1. Log in as admin and navigate to `/admin/users`
2. Click "Impersonate" on a test user
3. Decode the JWT cookie at jwt.io and verify:
   - `sub` equals the impersonated user's ID
   - `account_id` equals the impersonated user's account ID
4. Confirm the amber impersonation banner appears at the top of the page
5. Open the projects page and verify it shows the impersonated user's projects (not the admin's)
6. Click "Stop Impersonating"
7. Verify the JWT is restored to the admin's credentials and the banner disappears
8. Verify projects now show the admin's data

## Edge Cases

- **User with no accounts**: The `refresh_jwt` method returns early if account is nil, preventing NoMethodError
- **Pre-existing session account**: Explicitly overwritten with the impersonated user's account
- **ActsAsTenant reset**: The tenant is reset via `set_current_tenant(Current.account)` on the next request after `session[:account_id]` is updated
