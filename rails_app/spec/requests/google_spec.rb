require "swagger_helper"

RSpec.describe "Google API", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "pro")
  end

  def auth_headers
    auth_headers_for(user)
  end

  path "/api/v1/google/connection_status" do
    get "Returns Google OAuth connection status" do
      tags "Google"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      response "200", "returns connection status when not connected" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["connected"]).to be false
          expect(data["email"]).to be_nil
        end
      end

      response "200", "returns connection status when connected" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          create(:connected_account, owner: user, provider: "google_oauth2", auth: { "info" => { "email" => "test@gmail.com" } })
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["connected"]).to be true
          expect(data["email"]).to eq("test@gmail.com")
        end
      end

      response "401", "unauthorized" do
        let(:Authorization) { nil }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  path "/api/v1/google/invite_status" do
    get "Returns Google Ads invite status" do
      tags "Google"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      response "200", "returns invite status when no invite exists" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["accepted"]).to be false
          expect(data["status"]).to eq("none")
          expect(data["email"]).to be_nil
        end
      end

      response "200", "returns invite status when invite is pending" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          ads_account = create(:ads_account, account: account, platform: "google")
          create(:ads_account_invitation,
            ads_account: ads_account,
            platform: "google",
            email_address: "test@gmail.com",
            platform_settings: { google: { status: "pending" } })
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["accepted"]).to be false
          expect(data["status"]).to eq("pending")
          expect(data["email"]).to eq("test@gmail.com")
        end
      end

      response "200", "returns invite status when invite is accepted" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          ads_account = create(:ads_account, account: account, platform: "google")
          create(:ads_account_invitation,
            ads_account: ads_account,
            platform: "google",
            email_address: "test@gmail.com",
            platform_settings: { google: { status: "accepted" } })
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["accepted"]).to be true
          expect(data["status"]).to eq("accepted")
          expect(data["email"]).to eq("test@gmail.com")
        end
      end

      response "401", "unauthorized" do
        let(:Authorization) { nil }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end
end
