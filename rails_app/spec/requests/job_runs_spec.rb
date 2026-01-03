require "rails_helper"

RSpec.describe "Job Runs API", type: :request do
  let(:user) { create(:user) }
  let(:account) { user.owned_account }
  let(:website) { create(:website, account: account) }
  let(:campaign) { create(:campaign, account: account, website: website) }

  let(:headers) { auth_headers_for(user) }

  describe "POST /api/v1/job_runs" do
    let(:valid_params) do
      {
        job_class: "CampaignDeployWorker",
        arguments: { campaign_id: campaign.id },
        thread_id: "thread_abc123",
        callback_url: "http://localhost:4000/webhooks/job_run_callback"
      }
    end

    context "with valid authentication" do
      context "with valid job_class" do
        it "creates a job_run and enqueues the worker" do
          expect(CampaignDeployWorker).to receive(:perform_async).with(kind_of(Integer))

          post "/api/v1/job_runs", params: valid_params, headers: headers, as: :json

          expect(response).to have_http_status(:created)
          json = JSON.parse(response.body)
          expect(json["id"]).to be_present
          expect(json["status"]).to eq("pending")

          job_run = JobRun.find(json["id"])
          expect(job_run.account_id).to eq(account.id)
          expect(job_run.job_class).to eq("CampaignDeployWorker")
          expect(job_run.langgraph_thread_id).to eq("thread_abc123")
          expect(job_run.langgraph_callback_url).to eq("http://localhost:4000/webhooks/job_run_callback")
          expect(job_run.job_args["campaign_id"]).to eq(campaign.id)
          expect(job_run.job_args["account_id"]).to eq(account.id)
        end
      end

      context "with invalid job_class" do
        it "returns an error" do
          post "/api/v1/job_runs",
               params: valid_params.merge(job_class: "InvalidJob"),
               headers: headers,
               as: :json

          expect(response).to have_http_status(:unprocessable_entity)
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Invalid job class")
        end
      end

      context "with missing job_class" do
        it "returns an error" do
          post "/api/v1/job_runs",
               params: valid_params.except(:job_class),
               headers: headers,
               as: :json

          expect(response).to have_http_status(:unprocessable_entity)
        end
      end
    end

    context "without authentication" do
      it "returns unauthorized" do
        post "/api/v1/job_runs", params: valid_params, as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with expired token" do
      it "returns unauthorized" do
        expired_headers = expired_auth_headers_for(user)
        post "/api/v1/job_runs", params: valid_params, headers: expired_headers, as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "authorization" do
    let(:other_user) { create(:user) }
    let(:other_account) { other_user.owned_account }
    let(:other_campaign) { create(:campaign, account: other_account, website: create(:website, account: other_account)) }

    context "when job_args reference another account's resources" do
      it "creates job_run scoped to requesting account (job may fail later during execution)" do
        # The controller doesn't validate resource ownership - it just creates the job_run
        # The actual job will fail if it can't find the resource in the account's scope
        params = {
          job_class: "CampaignDeployWorker",
          arguments: { campaign_id: other_campaign.id },
          thread_id: "thread_abc123",
          callback_url: "http://localhost:4000/webhooks/job_run_callback"
        }

        expect(CampaignDeployWorker).to receive(:perform_async).with(kind_of(Integer))

        post "/api/v1/job_runs", params: params, headers: headers, as: :json

        expect(response).to have_http_status(:created)

        job_run = JobRun.last
        # The job_run is scoped to the requesting account
        expect(job_run.account_id).to eq(account.id)
        # The actual account_id injected for the job to use
        expect(job_run.job_args["account_id"]).to eq(account.id)
      end
    end
  end
end
