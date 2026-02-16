require "swagger_helper"

RSpec.describe "Google API", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
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

  path "/api/v1/google/refresh_invite_status" do
    post "Live-refreshes Google Ads invite status" do
      tags "Google"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { job_run_id: { type: :integer } }
      }, required: false

      response "200", "returns status when no invitation exists" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["accepted"]).to be false
          expect(data["status"]).to eq("none")
        end
      end

      response "200", "refreshes from Google and returns accepted status, completing the job run" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        let!(:ads_account) { create(:ads_account, account: account, platform: "google") }
        let!(:invitation) do
          create(:ads_account_invitation,
            ads_account: ads_account,
            platform: "google",
            email_address: "test@gmail.com",
            platform_settings: { google: { status: "pending" } })
        end
        let!(:job_run) do
          create(:job_run,
            account: account,
            job_class: "GoogleAdsInvite",
            status: "running",
            langgraph_thread_id: "thread_123")
        end
        let(:body) { { job_run_id: job_run.id } }

        before do
          allow(ENV).to receive(:[]).and_call_original
          allow(ENV).to receive(:[]).with("LANGGRAPH_API_URL").and_return("http://localhost:4000")
          # Simulate Google returning accepted
          allow_any_instance_of(AdsAccountInvitation).to receive(:google_refresh_status) do |inv|
            inv.update!(platform_settings: { google: { status: "accepted" } })
          end
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["accepted"]).to be true
          expect(data["status"]).to eq("accepted")

          job_run.reload
          expect(job_run.status).to eq("completed")
          expect(job_run.result_data).to eq({ "status" => "accepted" })
          expect(LanggraphCallbackWorker.jobs.size).to eq(1)
        end
      end

      response "200", "enqueues PollInviteAcceptanceWorker when not yet accepted" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        let!(:ads_account) { create(:ads_account, account: account, platform: "google") }
        let!(:invitation) do
          create(:ads_account_invitation,
            ads_account: ads_account,
            platform: "google",
            email_address: "test@gmail.com",
            platform_settings: { google: { status: "pending" } })
        end
        let!(:job_run) do
          create(:job_run,
            account: account,
            job_class: "GoogleAdsInvite",
            status: "running",
            langgraph_thread_id: "thread_123")
        end
        let(:body) { { job_run_id: job_run.id } }

        before do
          # Google still says pending
          allow_any_instance_of(AdsAccountInvitation).to receive(:google_refresh_status)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["accepted"]).to be false
          expect(data["status"]).to eq("pending")

          expect(job_run.reload.status).to eq("running")
          expect(GoogleAds::PollInviteAcceptanceWorker.jobs.size).to eq(1)
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

  path "/api/v1/google/payment_status" do
    get "Returns Google Ads payment/billing status" do
      tags "Google"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false

      response "200", "returns payment status when no ads account exists" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["has_payment"]).to be false
          expect(data["status"]).to eq("none")
        end
      end

      response "200", "returns payment status when ads account exists but no billing" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          create(:ads_account, account: account, platform: "google",
            platform_settings: { google: { customer_id: "1234567890" } })
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["has_payment"]).to be false
          expect(data["status"]).to eq("pending")
        end
      end

      response "200", "returns payment status when billing is approved" do
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          create(:ads_account, account: account, platform: "google",
            platform_settings: {
              google: {
                customer_id: "1234567890",
                billing_status: "approved"
              }
            })
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["has_payment"]).to be true
          expect(data["status"]).to eq("approved")
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
