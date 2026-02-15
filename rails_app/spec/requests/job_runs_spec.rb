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
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:job_run_params) do
          {
            job_class: "CampaignDeploy",
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123"
          }
        end

        before do
          allow(CampaignDeploy).to receive(:deploy)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to be_present
          expect(data['status']).to eq('pending')

          job_run = JobRun.find(data['id'])
          expect(job_run.account_id).to eq(account.id)
          expect(job_run.job_class).to eq("CampaignDeploy")
          expect(job_run.langgraph_thread_id).to eq("thread_abc123")
          # Callback URL is auto-constructed from LANGGRAPH_API_URL env var, not from client
          expect(job_run.langgraph_callback_url).to eq("#{ENV["LANGGRAPH_API_URL"]}/webhooks/job_run_callback")
          expect(job_run.job_args["campaign_id"]).to eq(campaign.id)
          expect(job_run.job_args["account_id"]).to eq(account.id)

          expect(CampaignDeploy).to have_received(:deploy)
            .with(campaign, job_run_id: job_run.id)
        end
      end

      response '201', 'ignores client-provided callback_url (SSRF prevention)' do
        schema APISchemas::JobRun.response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:job_run_params) do
          {
            job_class: "CampaignDeploy",
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123",
            callback_url: "http://attacker.com/evil-callback"
          }
        end

        before do
          allow(CampaignDeploy).to receive(:deploy)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          job_run = JobRun.find(data['id'])

          # Client-provided callback_url is ignored; URL is constructed from server config
          expect(job_run.langgraph_callback_url).to eq("#{ENV["LANGGRAPH_API_URL"]}/webhooks/job_run_callback")
          expect(job_run.langgraph_callback_url).not_to include("attacker.com")
        end
      end

      response '201', 'filters unpermitted arguments' do
        schema APISchemas::JobRun.response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:job_run_params) do
          {
            job_class: "CampaignDeploy",
            arguments: {
              campaign_id: campaign.id,
              malicious_param: "should_be_filtered",
              nested: {evil: "data"}
            },
            thread_id: "thread_abc123"
          }
        end

        before do
          allow(CampaignDeploy).to receive(:deploy)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          job_run = JobRun.find(data['id'])

          # Only permitted params should be stored
          expect(job_run.job_args.keys).to match_array(%w[campaign_id account_id])
          expect(job_run.job_args["campaign_id"]).to eq(campaign.id)
          expect(job_run.job_args["account_id"]).to eq(account.id)

          # Unpermitted params should NOT be stored
          expect(job_run.job_args).not_to have_key("malicious_param")
          expect(job_run.job_args).not_to have_key("nested")
        end
      end

      response '422', 'invalid job_class' do
        schema APISchemas::JobRun.error_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:job_run_params) do
          {
            job_class: "InvalidJob",
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include("Invalid job type")
        end
      end

      response '404', 'campaign not found' do
        schema APISchemas::JobRun.error_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:job_run_params) do
          {
            job_class: "CampaignDeploy",
            arguments: {campaign_id: 999999},
            thread_id: "thread_abc123"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to be_present
        end
      end

      response '422', 'missing job_class' do
        schema APISchemas::JobRun.error_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:job_run_params) do
          {
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to be_present
        end
      end

      response '422', 'does not enqueue job when job_run creation fails' do
        schema APISchemas::JobRun.error_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:job_run_params) do
          {
            job_class: "CampaignDeploy",
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123"
          }
        end

        before do
          # Force job_run creation to fail after validation
          allow_any_instance_of(JobRun).to receive(:save!).and_raise(
            ActiveRecord::RecordInvalid.new(JobRun.new)
          )
          allow(CampaignDeploy).to receive(:deploy)
        end

        run_test! do |response|
          # Verify job was NOT dispatched when creation failed
          expect(CampaignDeploy).not_to have_received(:deploy)
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:job_run_params) do
          {
            job_class: "CampaignDeploy",
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123"
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
            job_class: "CampaignDeploy",
            arguments: {campaign_id: campaign.id},
            thread_id: "thread_abc123"
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  # Show endpoint (used by Langgraph for status check fallback)
  describe 'Show job run' do
    let!(:job_run) do
      create(:job_run,
        account: account,
        job_class: "WebsiteDeploy",
        status: "completed",
        result_data: { "url" => "https://example.com" },
        langgraph_thread_id: "thread_show123")
    end

    path '/api/v1/job_runs/{id}' do
      get 'Returns job run status and result' do
        tags 'Job Runs'
        produces 'application/json'
        security [bearer_auth: []]
        parameter name: :Authorization, in: :header, type: :string, required: false
        parameter name: 'X-Signature', in: :header, type: :string, required: false
        parameter name: 'X-Timestamp', in: :header, type: :string, required: false
        parameter name: :id, in: :path, type: :integer, required: true

        response '200', 'returns job run with status and result' do
          schema APISchemas::JobRun.show_response
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { job_run.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data['id']).to eq(job_run.id)
            expect(data['status']).to eq('completed')
            expect(data['result']).to eq({ "url" => "https://example.com" })
            expect(data['error']).to be_nil
          end
        end

        response '200', 'returns error for failed job run' do
          schema APISchemas::JobRun.show_response
          let!(:failed_job_run) do
            create(:job_run,
              account: account,
              job_class: "WebsiteDeploy",
              status: "failed",
              error_message: "Deploy failed: timeout",
              langgraph_thread_id: "thread_fail123")
          end
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { failed_job_run.id }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data['status']).to eq('failed')
            expect(data['error']).to eq('Deploy failed: timeout')
          end
        end

        response '404', 'cannot access other accounts job run' do
          let!(:other_user) { create(:user) }
          let!(:other_account) { other_user.owned_account }
          let!(:other_job_run) do
            create(:job_run,
              account: other_account,
              job_class: "WebsiteDeploy",
              status: "completed",
              langgraph_thread_id: "thread_other123")
          end
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:id) { other_job_run.id }

          run_test! do |response|
            expect(response.code).to eq("404")
          end
        end
      end
    end
  end

  # WebsiteDeploy job type tests
  describe 'WebsiteDeploy job' do
    let!(:project) { create(:project, account: account) }
    let!(:deploy_website) { create(:website, account: account, project: project) }

    path '/api/v1/job_runs' do
      post 'Creates a WebsiteDeploy job run' do
        tags 'Job Runs'
        consumes 'application/json'
        produces 'application/json'
        security [bearer_auth: []]
        parameter name: :Authorization, in: :header, type: :string, required: false
        parameter name: 'X-Signature', in: :header, type: :string, required: false
        parameter name: 'X-Timestamp', in: :header, type: :string, required: false
        parameter name: :job_run_params, in: :body, schema: APISchemas::JobRun.params_schema

        response '201', 'creates job run and dispatches deploy_async on website' do
          schema APISchemas::JobRun.response
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:job_run_params) do
            {
              job_class: "WebsiteDeploy",
              arguments: { website_id: deploy_website.id },
              thread_id: "thread_deploy123"
            }
          end

          before do
            allow_any_instance_of(Website).to receive(:deploy_async)
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data['id']).to be_present
            expect(data['status']).to eq('pending')

            job_run = JobRun.find(data['id'])
            expect(job_run.job_class).to eq("WebsiteDeploy")
            expect(job_run.langgraph_thread_id).to eq("thread_deploy123")
            expect(job_run.job_args["website_id"]).to eq(deploy_website.id)
            expect(job_run.job_args["account_id"]).to eq(account.id)
          end
        end

        response '404', 'website not found' do
          schema APISchemas::JobRun.error_response
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:job_run_params) do
            {
              job_class: "WebsiteDeploy",
              arguments: { website_id: 999999 },
              thread_id: "thread_deploy123"
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data['errors']).to be_present
          end
        end
      end
    end
  end

  # GoogleOAuthConnect job type tests
  describe 'GoogleOAuthConnect job' do
    path '/api/v1/job_runs' do
      post 'Creates a GoogleOAuthConnect job run' do
        tags 'Job Runs'
        consumes 'application/json'
        produces 'application/json'
        security [bearer_auth: []]
        parameter name: :Authorization, in: :header, type: :string, required: false
        parameter name: 'X-Signature', in: :header, type: :string, required: false
        parameter name: 'X-Timestamp', in: :header, type: :string, required: false
        parameter name: :job_run_params, in: :body, schema: APISchemas::JobRun.params_schema

        response '201', 'creates job run without dispatching worker (OAuth is user-initiated)' do
          schema APISchemas::JobRun.response
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:job_run_params) do
            {
              job_class: "GoogleOAuthConnect",
              arguments: {},
              thread_id: "thread_oauth123"
            }
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data['id']).to be_present
            expect(data['status']).to eq('pending')

            job_run = JobRun.find(data['id'])
            expect(job_run.job_class).to eq("GoogleOAuthConnect")
            expect(job_run.langgraph_thread_id).to eq("thread_oauth123")
          end
        end
      end
    end
  end

  # GoogleAdsInvite job type tests
  describe 'GoogleAdsInvite job' do
    let!(:project) { create(:project, account: account) }
    let!(:deploy) { create(:deploy, project: project, status: "running") }

    path '/api/v1/job_runs' do
      post 'Creates a GoogleAdsInvite job run' do
        tags 'Job Runs'
        consumes 'application/json'
        produces 'application/json'
        security [bearer_auth: []]
        parameter name: :Authorization, in: :header, type: :string, required: false
        parameter name: 'X-Signature', in: :header, type: :string, required: false
        parameter name: 'X-Timestamp', in: :header, type: :string, required: false
        parameter name: :job_run_params, in: :body, schema: APISchemas::JobRun.params_schema

        response '201', 'creates job run and dispatches SendInviteWorker' do
          schema APISchemas::JobRun.response
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:job_run_params) do
            {
              job_class: "GoogleAdsInvite",
              arguments: {},
              thread_id: "thread_invite123"
            }
          end

          before do
            allow(GoogleAds::SendInviteWorker).to receive(:perform_async)
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data['id']).to be_present
            expect(data['status']).to eq('pending')

            job_run = JobRun.find(data['id'])
            expect(job_run.job_class).to eq("GoogleAdsInvite")
            expect(job_run.langgraph_thread_id).to eq("thread_invite123")

            expect(GoogleAds::SendInviteWorker).to have_received(:perform_async)
              .with(job_run.id)
          end
        end

        response '201', 'associates job run with deploy when deploy_id is provided' do
          schema APISchemas::JobRun.response
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:job_run_params) do
            {
              job_class: "GoogleAdsInvite",
              arguments: {},
              thread_id: "thread_invite123",
              deploy_id: deploy.id
            }
          end

          before do
            allow(GoogleAds::SendInviteWorker).to receive(:perform_async)
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            job_run = JobRun.find(data['id'])
            expect(job_run.deploy_id).to eq(deploy.id)
          end
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
    let!(:other_project) { create(:project, account: other_account) }
    let!(:other_deploy) { create(:deploy, project: other_project, status: "running") }

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

        response '404', 'cannot access other accounts campaign' do
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:job_run_params) do
            {
              job_class: "CampaignDeploy",
              arguments: {campaign_id: other_campaign.id},
              thread_id: "thread_abc123"
            }
          end

          run_test! do |response|
            # Controller now finds campaign directly, so it should 404
            expect(response.code).to eq("404")
          end
        end

        response '201', 'ignores deploy_id from other account (creates job without deploy)' do
          schema APISchemas::JobRun.response
          let(:auth_headers) { auth_headers_for(user) }
          let(:Authorization) { auth_headers['Authorization'] }
          let(:"X-Signature") { auth_headers['X-Signature'] }
          let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
          let(:job_run_params) do
            {
              job_class: "GoogleAdsInvite",
              arguments: {},
              thread_id: "thread_invite123",
              deploy_id: other_deploy.id
            }
          end

          before do
            allow(GoogleAds::SendInviteWorker).to receive(:perform_async)
          end

          run_test! do |response|
            data = JSON.parse(response.body)
            job_run = JobRun.find(data['id'])
            # Deploy from other account should be silently ignored
            expect(job_run.deploy_id).to be_nil
          end
        end
      end
    end
  end
end
