require 'swagger_helper'

RSpec.describe "Domains API", type: :request do
  include SubscriptionHelpers
  include PlanHelpers

  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_owned_account) { user1.owned_account }
  let!(:user1_team_account) { create_account_with_user(user1, account_name: "User 1 Team Account") }
  let!(:user2_owned_account) { user2.owned_account }

  let!(:project1_owned) { create(:project, account: user1_owned_account, name: "Project in Owned Account") }
  let!(:project1_team) { create(:project, account: user1_team_account, name: "Project in Team Account") }
  let!(:project2_owned) { create(:project, account: user2_owned_account, name: "User 2 Project") }

  let!(:website1_owned) { create(:website, account: user1_owned_account, project: project1_owned, name: "Owned Website") }
  let!(:website1_team) { create(:website, account: user1_team_account, project: project1_team, name: "Team Website") }
  let!(:website2_owned) { create(:website, account: user2_owned_account, project: project2_owned, name: "User 2 Website") }

  before do
    ensure_plans_exist
    subscribe_account(user1_owned_account, plan_name: "growth_monthly")
    subscribe_account(user1_team_account, plan_name: "growth_monthly")
    subscribe_account(user2_owned_account, plan_name: "growth_monthly")
    create_plan_limit(user1_owned_account.plan, 'platform_subdomains', 3)
  end

  path '/api/v1/domains' do
    post 'Creates a domain' do
      tags 'Domains'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :domain_params, in: :body, schema: APISchemas::Domain.params_schema

      before do
        switch_account_to(user1_owned_account)
      end

      response '201', 'domain created successfully' do
        schema APISchemas::Domain.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:domain_params) do
          {
            domain: {
              domain: 'mysite.launch10.site',
              website_id: website1_owned.id,
              is_platform_subdomain: true
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['domain']).to eq('mysite.launch10.site')
          expect(data['account_id']).to eq(user1_owned_account.id)
          expect(data['website_id']).to eq(website1_owned.id)
          expect(data['is_platform_subdomain']).to eq(true)
        end
      end

      response '201', 'domain created in team account after switching' do
        schema APISchemas::Domain.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:domain_params) do
          {
            domain: {
              domain: 'team-site.launch10.site',
              website_id: website1_team.id,
              is_platform_subdomain: true
            }
          }
        end

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['domain']).to eq('team-site.launch10.site')
          expect(data['account_id']).to eq(user1_team_account.id)
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:domain_params) do
          {
            domain: {
              domain: 'test.launch10.site'
            }
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end

      response '422', 'subdomain limit exceeded' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:domain_params) do
          {
            domain: {
              domain: 'site4.launch10.site',
              is_platform_subdomain: true
            }
          }
        end

        before do
          3.times do |i|
            create(:domain, :platform_subdomain, account: user1_owned_account, domain: "existing#{i}.launch10.site")
          end
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('You have reached the maximum number of platform subdomains for your plan')
        end
      end
    end

    get 'Lists domains for the account' do
      tags 'Domains'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :website_id, in: :query, type: :integer, required: false, description: 'Filter by website ID'

      let!(:domain1_owned) { create(:domain, domain: 'site1.launch10.site', account: user1_owned_account, website: website1_owned) }
      let!(:domain2_owned) { create(:domain, domain: 'site2.launch10.site', account: user1_owned_account, website: website1_owned) }
      let!(:domain1_team) { create(:domain, domain: 'team1.launch10.site', account: user1_team_account, website: website1_team) }
      let!(:domain2_other) { create(:domain, domain: 'other.launch10.site', account: user2_owned_account, website: website2_owned) }

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'returns domains for owned account' do
        schema APISchemas::Domain.list_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['domains'].length).to eq(2)
          domain_names = data['domains'].map { |d| d['domain'] }
          expect(domain_names).to include('site1.launch10.site', 'site2.launch10.site')
          expect(domain_names).not_to include('team1.launch10.site', 'other.launch10.site')
        end
      end

      response '200', 'returns domains for team account after switching' do
        schema APISchemas::Domain.list_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['domains'].length).to eq(1)
          expect(data['domains'].first['domain']).to eq('team1.launch10.site')
        end
      end

      response '200', 'filters domains by website_id' do
        schema APISchemas::Domain.list_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_id) { website1_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['domains'].length).to eq(2)
          data['domains'].each do |domain|
            expect(domain['website_id']).to eq(website1_owned.id)
          end
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  path '/api/v1/domains/search' do
    post 'Searches for domain availability' do
      tags 'Domains'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :search_params, in: :body, schema: APISchemas::Domain.search_params_schema

      let!(:domain1_owned) { create(:domain, :platform_subdomain, domain: 'my-existing.launch10.site', account: user1_owned_account, website: website1_owned) }
      let!(:domain2_other) { create(:domain, :platform_subdomain, domain: 'taken-by-other.launch10.site', account: user2_owned_account, website: website2_owned) }

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'returns availability statuses' do
        schema APISchemas::Domain.search_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:search_params) do
          {
            candidates: [
              'my-existing.launch10.site',
              'taken-by-other.launch10.site',
              'available-domain.launch10.site'
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          results = data['results']

          # Existing domain owned by current account
          existing = results.find { |r| r['domain'] == 'my-existing.launch10.site' }
          expect(existing['status']).to eq('existing')
          expect(existing['existing_id']).to eq(domain1_owned.id)

          # Domain owned by another account
          unavailable = results.find { |r| r['domain'] == 'taken-by-other.launch10.site' }
          expect(unavailable['status']).to eq('unavailable')
          expect(unavailable['existing_id']).to be_nil

          # Available domain
          available = results.find { |r| r['domain'] == 'available-domain.launch10.site' }
          expect(available['status']).to eq('available')
          expect(available['existing_id']).to be_nil

          # Check platform subdomain credits
          credits = data['platform_subdomain_credits']
          expect(credits['limit']).to eq(3)
          expect(credits['used']).to eq(1)
          expect(credits['remaining']).to eq(2)
        end
      end

      response '200', 'normalizes domain inputs' do
        schema APISchemas::Domain.search_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:search_params) do
          {
            candidates: [
              'https://MY-EXISTING.launch10.site/some/path',
              '  Available-Domain.launch10.site  '
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          results = data['results']

          # Should normalize to lowercase and strip protocol/path
          existing = results.find { |r| r['domain'] == 'my-existing.launch10.site' }
          expect(existing['status']).to eq('existing')

          available = results.find { |r| r['domain'] == 'available-domain.launch10.site' }
          expect(available['status']).to eq('available')
        end
      end

      response '422', 'missing candidates parameter' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:search_params) { {} }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('candidates parameter is required and must be an array')
        end
      end

      response '422', 'exceeds maximum candidates' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:search_params) do
          {
            candidates: (1..11).map { |i| "domain#{i}.launch10.site" }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('Maximum 10 candidates allowed')
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:search_params) do
          {
            candidates: ['test.launch10.site']
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  path '/api/v1/domains/{id}' do
    parameter name: :id, in: :path, type: :integer, description: 'Domain ID'

    get 'Retrieves a domain' do
      tags 'Domains'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      let!(:domain1_owned) { create(:domain, domain: 'site1.launch10.site', account: user1_owned_account, website: website1_owned) }
      let!(:domain1_team) { create(:domain, domain: 'team1.launch10.site', account: user1_team_account, website: website1_team) }
      let!(:domain2_other) { create(:domain, domain: 'other.launch10.site', account: user2_owned_account, website: website2_owned) }

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'domain found in owned account' do
        schema APISchemas::Domain.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { domain1_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(domain1_owned.id)
          expect(data['domain']).to eq('site1.launch10.site')
        end
      end

      response '404', 'cannot access team account domain from owned account' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { domain1_team.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('Not found')
        end
      end

      response '404', 'cannot access other user domain' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { domain2_other.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('Not found')
        end
      end

      response '200', 'domain found in team account after switching' do
        schema APISchemas::Domain.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { domain1_team.id }

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(domain1_team.id)
          expect(data['domain']).to eq('team1.launch10.site')
        end
      end
    end
  end
end
