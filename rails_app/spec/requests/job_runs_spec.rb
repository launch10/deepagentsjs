require 'swagger_helper'

RSpec.describe "Job Runs API", type: :request do
  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:website) { create(:website, account: account) }
  let!(:campaign) { create(:campaign, account: account, website: website) }

  path '/api/v1/job_runs' do
    post 'Creates a job run' do
      tags 'Job Runs'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :job_run_params, in: :body, schema: APISchemas::JobRun.params_schema

      response '201', 'job run created successfully' do
        schema APISchemas::JobRun.response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:job_run_params) do
          {
            job_class: "CampaignDeployWorker",
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123",
            callback_url: "http://localhost:4000/webhooks/job_run_callback"
          }
        end

        before do
          allow(CampaignDeployWorker).to receive(:perform_async)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to be_present
          expect(data['status']).to eq('pending')

          job_run = JobRun.find(data['id'])
          expect(job_run.account_id).to eq(account.id)
          expect(job_run.job_class).to eq("CampaignDeployWorker")
          expect(job_run.langgraph_thread_id).to eq("thread_abc123")
          expect(job_run.langgraph_callback_url).to eq("http://localhost:4000/webhooks/job_run_callback")
          expect(job_run.job_args["campaign_id"]).to eq(campaign.id)
          expect(job_run.job_args["account_id"]).to eq(account.id)
        end
      end

      response '422', 'invalid job_class' do
        schema APISchemas::JobRun.error_response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:job_run_params) do
          {
            job_class: "InvalidJob",
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123",
            callback_url: "http://localhost:4000/webhooks/job_run_callback"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include("Invalid job class")
        end
      end

      response '422', 'missing job_class' do
        schema APISchemas::JobRun.error_response
        let(:Authorization) { auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
        let(:job_run_params) do
          {
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123",
            callback_url: "http://localhost:4000/webhooks/job_run_callback"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to be_present
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:job_run_params) do
          {
            job_class: "CampaignDeployWorker",
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123",
            callback_url: "http://localhost:4000/webhooks/job_run_callback"
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end

      response '401', 'unauthorized - expired token' do
        let(:Authorization) { expired_auth_headers_for(user)['Authorization'] }
        let(:"X-Signature") { expired_auth_headers_for(user)['X-Signature'] }
        let(:"X-Timestamp") { expired_auth_headers_for(user)['X-Timestamp'] }
        let(:job_run_params) do
          {
            job_class: "CampaignDeployWorker",
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123",
            callback_url: "http://localhost:4000/webhooks/job_run_callback"
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  # Cross-account security tests
  describe 'Cross-account security' do
    let!(:other_user) { create(:user) }
    let!(:other_account) { other_user.owned_account }
    let!(:other_website) { create(:website, account: other_account) }
    let!(:other_campaign) { create(:campaign, account: other_account, website: other_website) }

    path '/api/v1/job_runs' do
      post 'Creates job run scoped to requesting account' do
        tags 'Job Runs'
        consumes 'application/json'
        produces 'application/json'
        security [bearer_auth: []]
        parameter name: :Authorization, in: :header, type: :string, required: false
        parameter name: 'X-Signature', in: :header, type: :string, required: false
        parameter name: 'X-Timestamp', in: :header, type: :string, required: false
        parameter name: :job_run_params, in: :body, schema: APISchemas::JobRun.params_schema

        response '201', 'job_run scoped to requesting account (job may fail later during execution)' do
          schema APISchemas::JobRun.response
          let(:Authorization) { auth_headers_for(user)['Authorization'] }
          let(:"X-Signature") { auth_headers_for(user)['X-Signature'] }
          let(:"X-Timestamp") { auth_headers_for(user)['X-Timestamp'] }
          let(:job_run_params) do
            {
              job_class: "CampaignDeployWorker",
              arguments: {campaign_id: other_campaign.id},
              thread_id: "thread_abc123",
              callback_url: "http://localhost:4000/webhooks/job_run_callback"
            }
          end

          before do
            allow(CampaignDeployWorker).to receive(:perform_async)
          end

          run_test! do |response|
            job_run = JobRun.last
            # The job_run is scoped to the requesting account
            expect(job_run.account_id).to eq(account.id)
            # The actual account_id injected for the job to use
            expect(job_run.job_args["account_id"]).to eq(account.id)
          end
        end
      end
    end
  end
end
