# E2E Tests for Deploy.tsx

## Goal

Test the Deploy flow end-to-end with mocked Google Ads API calls. Workers run their full code path - only the Google API responses are mocked.

## Key Constraint: Cross-Process State

Playwright → Rails (process A) → Sidekiq (process B). Mock state must be shared across processes, so we use **Redis** - not in-memory storage.

## Architecture

```
Test sets mock state via HTTP → Redis stores state
Test triggers worker via HTTP → Worker runs synchronously (SIDEKIQ_INLINE=true)
Worker calls GoogleAds.client → Returns TestClient when mocks enabled
TestClient.search() → Checks Redis for mock state → Returns appropriate response
Worker updates models → Fires webhook → Frontend polls and updates
```

**Stubbing at API client level** exercises the real service code that parses responses and updates models.

## Files to Create

### 1. `spec/support/schemas/e2e_schemas.rb`

```ruby
# frozen_string_literal: true

module APISchemas
  module E2e
    def self.status_response
      {
        type: :object,
        properties: {
          status: { type: :string, example: "ok" }
        },
        required: ["status"]
      }
    end

    def self.error_response
      {
        type: :object,
        properties: {
          error: { type: :string, example: "Worker not allowed" }
        },
        required: ["error"]
      }
    end

    def self.set_mock_params
      {
        type: :object,
        properties: {
          key: { type: :string, example: "invite_status" },
          value: { type: :string, example: "accepted" }
        },
        required: %w[key value]
      }
    end

    def self.trigger_worker_params
      {
        type: :object,
        properties: {
          worker: { type: :string, example: "GoogleAds::PollActiveInvitesWorker" },
          args: { type: :array, items: { type: :string }, nullable: true }
        },
        required: ["worker"]
      }
    end
  end
end
```

### 2. `spec/requests/test/e2e_spec.rb`

```ruby
require "swagger_helper"

RSpec.describe "Test E2E API", type: :request do
  before { allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("test")) }

  path "/test/e2e/enable_mocks" do
    post "Enables E2E mock mode" do
      tags "Test E2E"
      produces "application/json"

      response "200", "mocks enabled" do
        schema APISchemas::E2e.status_response
        run_test!
      end
    end
  end

  path "/test/e2e/set_mock" do
    post "Sets a mock value" do
      tags "Test E2E"
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: APISchemas::E2e.set_mock_params

      response "200", "mock value set" do
        schema APISchemas::E2e.status_response
        let(:params) { { key: "invite_status", value: "pending" } }
        run_test!
      end
    end
  end

  path "/test/e2e/trigger_worker" do
    post "Triggers a worker synchronously" do
      tags "Test E2E"
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: APISchemas::E2e.trigger_worker_params

      response "200", "worker triggered" do
        schema APISchemas::E2e.status_response
        let(:params) { { worker: "GoogleAds::PollActiveInvitesWorker" } }

        before do
          # Enable mocks first so worker doesn't hit real API
          Sidekiq.redis { |c| c.set("e2e_mock:enabled", "true") }
        end

        run_test!
      end

      response "403", "worker not allowed" do
        schema APISchemas::E2e.error_response
        let(:params) { { worker: "SomeOtherWorker" } }
        run_test!
      end
    end
  end

  path "/test/e2e/reset" do
    delete "Clears all mock state" do
      tags "Test E2E"
      produces "application/json"

      response "200", "mocks cleared" do
        schema APISchemas::E2e.status_response
        run_test!
      end
    end
  end
end
```

### 3. `lib/testing/google_ads_test_client.rb`

```ruby
module Testing
  class GoogleAdsTestClient
    # Only add chain methods when tests actually need them
    def service = self
    def google_ads = self

    def search(customer_id:, query:)
      status = redis_get(:invite_status)&.to_sym

      if query.include?("customer_user_access") && !query.include?("invitation")
        status == :accepted ? [user_access_response] : []
      elsif query.include?("customer_user_access_invitation")
        status && status != :accepted ? [invitation_response(status)] : []
      else
        []
      end
    end

    def mutate_customer_user_access_invitation(customer_id:, operation:)
      OpenStruct.new(result: OpenStruct.new(
        resource_name: "customers/#{customer_id}/customerUserAccessInvitations/#{rand(10000)}"
      ))
    end

    private

    def redis_get(key)
      Sidekiq.redis { |c| c.get("e2e_mock:#{key}") }
    end

    def user_access_response
      OpenStruct.new(
        customer_user_access: OpenStruct.new(
          resource_name: "customers/123/customerUserAccess/456",
          email_address: "test@launch10.ai",
          access_role: :ADMIN,
          access_creation_date_time: Time.current.iso8601
        ),
        customer_user_access_invitation: nil
      )
    end

    def invitation_response(status)
      OpenStruct.new(
        customer_user_access: nil,
        customer_user_access_invitation: OpenStruct.new(
          resource_name: "customers/123/customerUserAccessInvitations/789",
          email_address: "test@launch10.ai",
          access_role: :ADMIN,
          invitation_status: status.to_s.upcase.to_sym,
          creation_date_time: Time.current.iso8601
        )
      )
    end
  end
end
```

### 4. `app/controllers/test/e2e_controller.rb`

No separate mock store class - Redis calls inlined directly. With `SIDEKIQ_INLINE=true`, `perform_async` runs synchronously - no completion tracking needed.

```ruby
class Test::E2eController < Test::TestController
  REDIS_PREFIX = "e2e_mock"

  ALLOWED_WORKERS = %w[
    GoogleAds::PollActiveInvitesWorker
    GoogleAds::PollInviteAcceptanceWorker
    GoogleAds::SendInviteWorker
  ].freeze

  before_action :ensure_test_environment!

  # POST /test/e2e/enable_mocks
  def enable_mocks
    redis_set(:enabled, "true")
    render json: { status: "ok" }
  end

  # POST /test/e2e/set_mock
  def set_mock
    redis_set(params[:key], params[:value])
    render json: { status: "ok" }
  end

  # POST /test/e2e/trigger_worker
  # With SIDEKIQ_INLINE=true, this runs synchronously and returns when done
  def trigger_worker
    worker = params[:worker]
    return render json: { error: "Worker not allowed" }, status: :forbidden unless ALLOWED_WORKERS.include?(worker)

    args = params[:args].present? ? Array(params[:args]) : []
    worker.constantize.perform_async(*args)

    render json: { status: "ok" }
  end

  # DELETE /test/e2e/reset
  def reset
    clear_mock_keys
    render json: { status: "ok" }
  end

  # Check if mocks are enabled (called by GoogleAds.client)
  def self.mocks_enabled?
    return false unless Rails.env.test?
    Sidekiq.redis { |c| c.get("#{REDIS_PREFIX}:enabled") } == "true"
  rescue Redis::BaseConnectionError
    false
  end

  private

  def ensure_test_environment!
    head :not_found unless Rails.env.test?
  end

  def redis_set(key, value)
    Sidekiq.redis { |c| c.set("#{REDIS_PREFIX}:#{key}", value.to_s) }
  end

  def clear_mock_keys
    Sidekiq.redis do |c|
      cursor = "0"
      loop do
        cursor, keys = c.scan(cursor, match: "#{REDIS_PREFIX}:*", count: 100)
        c.del(*keys) if keys.any?
        break if cursor == "0"
      end
    end
  end
end
```

### 5. Routes in `config/routes.rb` (test-only)

```ruby
# Test-only routes - NOT in dev.rb
if Rails.env.test?
  namespace :test do
    post "e2e/enable_mocks", to: "e2e#enable_mocks"
    post "e2e/set_mock", to: "e2e#set_mock"
    post "e2e/trigger_worker", to: "e2e#trigger_worker"
    delete "e2e/reset", to: "e2e#reset"
  end
end
```

### 6. `e2e/fixtures/e2e-mocks.ts`

```typescript
import { e2eConfig } from "../config";

const BASE_URL = e2eConfig.railsBaseUrl;

async function post(path: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`E2E request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

export const E2EMocks = {
  async enable() {
    await post("/test/e2e/enable_mocks");
  },

  async reset() {
    await fetch(`${BASE_URL}/test/e2e/reset`, { method: "DELETE" });
  },

  async setInviteStatus(status: "pending" | "accepted" | "declined" | "expired") {
    await post("/test/e2e/set_mock", { key: "invite_status", value: status });
  },

  // With SIDEKIQ_INLINE=true, this returns when worker completes
  async triggerWorker(worker: string) {
    await post("/test/e2e/trigger_worker", { worker });
  },

  async pollInvites() {
    await this.triggerWorker("GoogleAds::PollActiveInvitesWorker");
  },
};
```

### 7. Snapshot Builder: `spec/snapshot_builders/deploy_step.rb`

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

## Files to Modify

### 1. `app/services/google_ads.rb`

```ruby
def client
  if Test::E2eController.mocks_enabled?
    require_relative "../../lib/testing/google_ads_test_client" unless defined?(Testing::GoogleAdsTestClient)
    return Testing::GoogleAdsTestClient.new
  end

  @client ||= Google::Ads::GoogleAds::GoogleAdsClient.new do |c|
    # ... existing config
  end
end
```

### 2. `schedule.rb`

```ruby
return if Rails.env.test?

Zhong.schedule do
  # ... existing schedule
end
```

## Test Flow

```
1. beforeEach:
   - DatabaseSnapshotter.restoreSnapshot("deploy_step")
   - E2EMocks.reset()      # Clear stale state FIRST
   - E2EMocks.enable()     # Then enable

2. Test sets initial mock state:
   - E2EMocks.setInviteStatus("pending")

3. Navigate to deploy page, start deploy

4. Simulate invite acceptance:
   - E2EMocks.setInviteStatus("accepted")
   - E2EMocks.pollInvites()  # Runs synchronously (SIDEKIQ_INLINE=true)

5. Assert UI shows accepted state

6. afterEach:
   - E2EMocks.reset()
```

## First Test: `e2e/deploy/deploy-website-only.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { DatabaseSnapshotter } from "../fixtures/database";
import { E2EMocks } from "../fixtures/e2e-mocks";
import { loginUser } from "../fixtures/auth";

test.describe("Deploy - Website Only", () => {
  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("deploy_step");
    await E2EMocks.reset();
    await E2EMocks.enable();
    await loginUser(page);
  });

  test.afterEach(async () => {
    await E2EMocks.reset();
  });

  test("deploys website without Google Ads", async ({ page }) => {
    const project = await DatabaseSnapshotter.getFirstProject();
    await page.goto(`/projects/${project.uuid}/deploy`);

    await expect(page.getByText("Deploy Your Campaign")).toBeVisible();
    await expect(page.getByText("deployed successfully")).toBeVisible({ timeout: 30000 });
  });
});
```

## Implementation Order

1. `spec/support/schemas/e2e_schemas.rb` (API schemas)
2. `spec/requests/test/e2e_spec.rb` (rswag spec)
3. `lib/testing/google_ads_test_client.rb`
4. `app/controllers/test/e2e_controller.rb`
5. Add routes to `config/routes.rb` (inside `if Rails.env.test?`)
6. Modify `app/services/google_ads.rb`
7. Modify `schedule.rb`
8. `e2e/fixtures/e2e-mocks.ts`
9. `spec/snapshot_builders/deploy_step.rb` + generate snapshot
10. Run `rake rswag:specs:swaggerize` to generate OpenAPI spec
11. Write first E2E test
