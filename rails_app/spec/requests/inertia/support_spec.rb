# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Support Inertia Page", type: :request, inertia: true do
  include Devise::Test::IntegrationHelpers

  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }

  describe "GET /support" do
    context "when user is subscribed" do
      before do
        ensure_plans_exist
        subscribe_account(account, plan_name: "growth_monthly")
        sign_in user
      end

      it "renders the Support component" do
        get support_path

        expect(response).to have_http_status(:ok)
        expect(inertia.component).to eq("Support")
      end

      it "passes categories prop" do
        get support_path

        expect(inertia.props[:categories]).to eq(SupportRequest::CATEGORIES)
      end

      it "creates a support chat and passes thread_id" do
        expect {
          get support_path
        }.to change(Chat, :count).by(1)

        expect(inertia.props[:thread_id]).to be_present
      end

      it "reuses existing support chat on subsequent visits" do
        get support_path
        thread_id = inertia.props[:thread_id]

        expect {
          get support_path
        }.not_to change(Chat, :count)

        expect(inertia.props[:thread_id]).to eq(thread_id)
      end
    end

    context "when user has no active subscription" do
      before do
        ensure_plans_exist
        sign_in user
      end

      it "redirects to pricing page" do
        get support_path

        expect(response).to redirect_to(pricing_path)
      end
    end

    context "when user is not authenticated" do
      it "returns 404" do
        get "/support"

        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "POST /support" do
    before do
      ensure_plans_exist
      subscribe_account(account, plan_name: "growth_monthly")
      sign_in user
    end

    let(:valid_params) do
      {
        support_request: {
          category: "Report a bug",
          subject: "Something is broken",
          description: "When I click the deploy button, nothing happens and the page just sits there loading.",
          submitted_from_url: "http://localhost:3000/dashboard",
          browser_info: "Mozilla/5.0"
        }
      }
    end

    it "creates a support request with valid params" do
      expect {
        post support_path, params: valid_params
      }.to change(SupportRequest, :count).by(1)
    end

    it "redirects to support path on success" do
      post support_path, params: valid_params

      expect(response).to redirect_to(support_path)
      expect(flash[:notice]).to include("Request submitted")
    end

    it "sets user and account on the support request" do
      post support_path, params: valid_params

      support_request = SupportRequest.last
      expect(support_request.user).to eq(user)
      expect(support_request.account).to eq(account)
    end

    it "auto-captures subscription tier and credits" do
      post support_path, params: valid_params

      support_request = SupportRequest.last
      expect(support_request.subscription_tier).to be_present
      expect(support_request.credits_remaining).to be_a(Numeric)
    end

    it "enqueues email delivery" do
      expect {
        post support_path, params: valid_params
      }.to have_enqueued_mail(SupportMailer, :support_request)
    end

    it "enqueues Slack notification worker" do
      expect(Support::SlackNotificationWorker).to receive(:perform_async).with(kind_of(Integer))

      post support_path, params: valid_params
    end

    it "enqueues Notion creation worker" do
      expect(Support::NotionCreationWorker).to receive(:perform_async).with(kind_of(Integer))

      post support_path, params: valid_params
    end

    context "when rate limited" do
      it "allows up to MAX_REQUESTS_PER_HOUR requests" do
        4.times { post support_path, params: valid_params }

        expect {
          post support_path, params: valid_params
        }.to change(SupportRequest, :count).by(1)
      end

      it "rejects requests beyond the rate limit" do
        5.times { post support_path, params: valid_params }

        expect {
          post support_path, params: valid_params
        }.not_to change(SupportRequest, :count)
      end

      it "does not count requests older than one hour" do
        5.times do
          sr = create(:support_request, user: user, account: account)
          sr.update_column(:created_at, 61.minutes.ago)
        end

        expect {
          post support_path, params: valid_params
        }.to change(SupportRequest, :count).by(1)
      end
    end

    context "with invalid params" do
      it "does not create a support request with blank subject" do
        expect {
          post support_path, params: {
            support_request: valid_params[:support_request].merge(subject: "")
          }
        }.not_to change(SupportRequest, :count)
      end

      it "does not create a support request with blank description" do
        expect {
          post support_path, params: {
            support_request: valid_params[:support_request].merge(description: "")
          }
        }.not_to change(SupportRequest, :count)
      end

      it "does not create a support request with invalid category" do
        expect {
          post support_path, params: {
            support_request: valid_params[:support_request].merge(category: "Invalid")
          }
        }.not_to change(SupportRequest, :count)
      end

      it "redirects with errors in session" do
        post support_path, params: {
          support_request: valid_params[:support_request].merge(subject: "")
        }

        expect(response).to redirect_to(support_path)
      end
    end
  end
end
