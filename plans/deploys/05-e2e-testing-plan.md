# E2E Testing for Deploy Flow

## Problem

The Deploy page integrates with Google Ads APIs to send account invitations and poll for acceptance. Testing this flow end-to-end requires mocking the Google Ads API without bypassing the service layer code that parses responses and updates models.

## Solution

Stub the `GoogleAds.client` at the module level with a mock client that returns configurable responses. With `SIDEKIQ_INLINE=true`, workers run synchronously in the same Rails process, so mock state can live in-memory without Redis.

## Architecture

```
Playwright calls Rails via HTTP
  → Rails handles request
  → Worker runs synchronously (SIDEKIQ_INLINE=true)
  → Worker calls GoogleAds.client
  → Returns mock client with in-process state
  → Worker updates models
  → Response returns to Playwright
```

## Implementation

### 1. Response Factories: `lib/testing/google_ads_responses.rb`

Factory methods that return OpenStruct objects matching the Google Ads API response structure.

```ruby
module Testing
  module GoogleAdsResponses
    def self.invitation_row(status:, email: "test@launch10.ai")
      OpenStruct.new(
        customer_user_access_invitation: OpenStruct.new(
          resource_name: "customers/123/customerUserAccessInvitations/456",
          email_address: email,
          access_role: :ADMIN,
          invitation_status: status.to_s.upcase.to_sym,
          creation_date_time: Time.current.iso8601
        ),
        customer_user_access: nil
      )
    end

    def self.user_access_row(email: "test@launch10.ai")
      OpenStruct.new(
        customer_user_access: OpenStruct.new(
          resource_name: "customers/123/customerUserAccess/789",
          email_address: email,
          access_role: :ADMIN,
          access_creation_date_time: Time.current.iso8601
        ),
        customer_user_access_invitation: nil
      )
    end

    def self.mutate_invitation_response(customer_id:)
      OpenStruct.new(
        result: OpenStruct.new(
          resource_name: "customers/#{customer_id}/customerUserAccessInvitations/#{rand(10000)}"
        )
      )
    end
  end
end
```

### 2. Mock Client: `lib/testing/e2e_google_ads_client.rb`

A mock Google Ads client that mimics the real client's interface. The `invite_status` attribute controls what responses are returned.

```ruby
module Testing
  class E2eGoogleAdsClient
    attr_accessor :invite_status

    def service
      E2eService.new(self)
    end

    def resource
      E2eResourceBuilder.new
    end

    def operation
      E2eOperationBuilder.new
    end

    class E2eService
      def initialize(client)
        @client = client
      end

      def google_ads
        E2eGoogleAdsService.new(@client)
      end

      def customer_user_access_invitation
        E2eInvitationService.new(@client)
      end
    end

    class E2eGoogleAdsService
      def initialize(client)
        @client = client
      end

      def search(customer_id:, query:)
        status = @client.invite_status

        if query.include?("customer_user_access") && !query.include?("invitation")
          status == "accepted" ? [GoogleAdsResponses.user_access_row] : []
        elsif query.include?("customer_user_access_invitation")
          status && status != "accepted" ? [GoogleAdsResponses.invitation_row(status: status)] : []
        else
          []
        end
      end
    end

    class E2eInvitationService
      def initialize(client)
        @client = client
      end

      def mutate_customer_user_access_invitation(customer_id:, operation:)
        GoogleAdsResponses.mutate_invitation_response(customer_id: customer_id)
      end
    end

    class E2eResourceBuilder
      def customer_user_access_invitation
        invitation = OpenStruct.new
        yield invitation if block_given?
        invitation
      end
    end

    class E2eOperationBuilder
      def create_resource
        E2eCreateResource.new
      end
    end

    class E2eCreateResource
      def customer_user_access_invitation(invitation)
        invitation
      end
    end
  end
end
```

### 3. Test Controller: `app/controllers/test/e2e_controller.rb`

HTTP endpoints for Playwright to control mock state.

```ruby
class Test::E2eController < Test::TestController
  # POST /test/e2e/set_invite_status
  def set_invite_status
    GoogleAds.e2e_mock_client ||= Testing::E2eGoogleAdsClient.new
    GoogleAds.e2e_mock_client.invite_status = params[:status]
    render json: { status: "ok" }
  end

  # DELETE /test/e2e/reset
  def reset
    GoogleAds.e2e_mock_client = nil
    render json: { status: "ok" }
  end
end
```

### 4. Routes: `config/routes/dev.rb`

Add within the existing `namespace :test` block:

```ruby
namespace :test do
  # existing routes...

  post "e2e/set_invite_status", to: "e2e#set_invite_status"
  delete "e2e/reset", to: "e2e#reset"
end
```

### 5. GoogleAds Module: `app/services/google_ads.rb`

Add a module-level accessor that takes precedence over the real client.

```ruby
module GoogleAds
  class << self
    attr_accessor :e2e_mock_client
  end

  def self.client
    return e2e_mock_client if e2e_mock_client.present?

    @client ||= Google::Ads::GoogleAds::GoogleAdsClient.new do |c|
      # existing configuration...
    end
  end
end
```

### 6. Scheduler: `schedule.rb`

Disable scheduled jobs in test environment to prevent interference.

```ruby
return if Rails.env.test?

Zhong.schedule do
  # existing schedule...
end
```

### 7. TypeScript Helper: `e2e/fixtures/e2e-mocks.ts`

```typescript
import { e2eConfig } from "../config";

const BASE_URL = e2eConfig.railsBaseUrl;

export const E2EMocks = {
  async setInviteStatus(status: "pending" | "accepted" | "declined" | "expired") {
    const response = await fetch(`${BASE_URL}/test/e2e/set_invite_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      throw new Error(`Failed to set invite status: ${response.status}`);
    }
  },

  async reset() {
    await fetch(`${BASE_URL}/test/e2e/reset`, { method: "DELETE" });
  },
};
```

### 8. Database Snapshot: `spec/snapshot_builders/deploy_step.rb`

Creates a test fixture with a user who has Google OAuth connected and a pending deploy.

```ruby
class DeployStep < BaseBuilder
  def base_snapshot
    "campaign_review_step"
  end

  def output_name
    "deploy_step"
  end

  def build
    user = Account.first.users.first
    website = Campaign.first.website

    user.connected_accounts.where(provider: "google_oauth2").destroy_all
    user.connected_accounts.create!(
      provider: "google_oauth2",
      uid: "123456789",
      access_token: "mock_token",
      refresh_token: "mock_refresh",
      expires_at: 1.day.from_now
    )
    user.update!(google_email: "test@launch10.ai")

    website.deploys.create!(status: "pending", deploy_type: "full")
  end
end
```

### 9. Example Test: `e2e/deploy/deploy-invite-flow.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { DatabaseSnapshotter } from "../fixtures/database";
import { E2EMocks } from "../fixtures/e2e-mocks";
import { loginUser } from "../fixtures/auth";

test.describe("Deploy - Google Ads Invite Flow", () => {
  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("deploy_step");
    await E2EMocks.reset();
    await loginUser(page);
  });

  test.afterEach(async () => {
    await E2EMocks.reset();
  });

  test("shows pending state then accepted state", async ({ page }) => {
    await E2EMocks.setInviteStatus("pending");

    const project = await DatabaseSnapshotter.getFirstProject();
    await page.goto(`/projects/${project.uuid}/deploy`);

    await expect(page.getByText(/waiting|pending/i)).toBeVisible();

    await E2EMocks.setInviteStatus("accepted");

    await expect(page.getByText(/accepted|connected/i)).toBeVisible({ timeout: 10000 });
  });

  test("deploys website without Google Ads", async ({ page }) => {
    const project = await DatabaseSnapshotter.getFirstProject();
    await page.goto(`/projects/${project.uuid}/deploy`);

    await expect(page.getByText("Deploy Your Campaign")).toBeVisible();
    await expect(page.getByText(/deployed successfully/i)).toBeVisible({ timeout: 30000 });
  });
});
```

## Verification

1. Start the test server: `bin/dev-test`
2. Run the E2E tests: `pnpm test:e2e e2e/deploy/deploy-invite-flow.spec.ts`
3. Verify the invite flow test transitions from pending to accepted state
4. Verify the website-only deploy test completes without Google Ads mocking

## Implementation Order

1. `lib/testing/google_ads_responses.rb`
2. `lib/testing/e2e_google_ads_client.rb`
3. `app/controllers/test/e2e_controller.rb`
4. Routes in `config/routes/dev.rb`
5. Modify `app/services/google_ads.rb`
6. Modify `schedule.rb`
7. `e2e/fixtures/e2e-mocks.ts`
8. `spec/snapshot_builders/deploy_step.rb` + generate snapshot
9. Write E2E tests
