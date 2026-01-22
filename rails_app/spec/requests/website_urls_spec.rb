require 'swagger_helper'

RSpec.describe "WebsiteUrls API", type: :request do
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

  let!(:domain1_owned) { create(:domain, domain: 'site1.launch10.site', account: user1_owned_account, website: website1_owned) }
  let!(:domain1_team) { create(:domain, domain: 'team1.launch10.site', account: user1_team_account, website: website1_team) }
  let!(:domain2_owned) { create(:domain, domain: 'other.launch10.site', account: user2_owned_account, website: website2_owned) }

  before do
    ensure_plans_exist
    subscribe_account(user1_owned_account, plan_name: "growth_monthly")
    subscribe_account(user1_team_account, plan_name: "growth_monthly")
    subscribe_account(user2_owned_account, plan_name: "growth_monthly")
  end

  path '/api/v1/website_urls' do
    post 'Creates a website URL' do
      tags 'WebsiteUrls'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :website_url_params, in: :body, schema: APISchemas::WebsiteUrl.params_schema

      before do
        switch_account_to(user1_owned_account)
      end

      response '201', 'website URL created successfully' do
        schema APISchemas::WebsiteUrl.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_url_params) do
          {
            website_url: {
              domain_id: domain1_owned.id,
              website_id: website1_owned.id,
              path: '/landing-page'
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['path']).to eq('/landing-page')
          expect(data['account_id']).to eq(user1_owned_account.id)
          expect(data['website_id']).to eq(website1_owned.id)
          expect(data['domain_id']).to eq(domain1_owned.id)
        end
      end

      response '201', 'website URL created in team account after switching' do
        schema APISchemas::WebsiteUrl.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_url_params) do
          {
            website_url: {
              domain_id: domain1_team.id,
              website_id: website1_team.id,
              path: '/team-page'
            }
          }
        end

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['path']).to eq('/team-page')
          expect(data['account_id']).to eq(user1_team_account.id)
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:website_url_params) do
          {
            website_url: {
              domain_id: domain1_owned.id,
              website_id: website1_owned.id,
              path: '/test'
            }
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end

      response '422', 'duplicate domain and path' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_url_params) do
          {
            website_url: {
              domain_id: domain1_owned.id,
              website_id: website1_owned.id,
              path: '/existing-path'
            }
          }
        end

        before do
          create(:website_url, domain: domain1_owned, website: website1_owned, account: user1_owned_account, path: '/existing-path')
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('A website URL with this domain and path already exists')
        end
      end

      response '422', 'domain does not belong to account' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_url_params) do
          {
            website_url: {
              domain_id: domain2_owned.id,
              website_id: website1_owned.id,
              path: '/test'
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          # With acts_as_tenant, domains from other accounts don't exist in the current tenant scope
          expect(data['errors']).to include('Domain must exist')
        end
      end
    end

    get 'Lists website URLs for the account' do
      tags 'WebsiteUrls'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :website_id, in: :query, type: :integer, required: false, description: 'Filter by website ID'
      parameter name: :domain_id, in: :query, type: :integer, required: false, description: 'Filter by domain ID'

      let!(:url1_owned) { create(:website_url, path: '/page1', account: user1_owned_account, website: website1_owned, domain: domain1_owned) }
      let!(:url2_owned) { create(:website_url, path: '/page2', account: user1_owned_account, website: website1_owned, domain: domain1_owned) }
      let!(:url1_team) { create(:website_url, path: '/team-page', account: user1_team_account, website: website1_team, domain: domain1_team) }
      let!(:url2_other) { create(:website_url, path: '/other-page', account: user2_owned_account, website: website2_owned, domain: domain2_owned) }

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'returns website URLs for owned account' do
        schema APISchemas::WebsiteUrl.list_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['website_urls'].length).to eq(2)
          paths = data['website_urls'].map { |u| u['path'] }
          expect(paths).to include('/page1', '/page2')
          expect(paths).not_to include('/team-page', '/other-page')
        end
      end

      response '200', 'returns website URLs for team account after switching' do
        schema APISchemas::WebsiteUrl.list_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['website_urls'].length).to eq(1)
          expect(data['website_urls'].first['path']).to eq('/team-page')
        end
      end

      response '200', 'filters website URLs by website_id' do
        schema APISchemas::WebsiteUrl.list_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_id) { website1_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['website_urls'].length).to eq(2)
          data['website_urls'].each do |url|
            expect(url['website_id']).to eq(website1_owned.id)
          end
        end
      end

      response '200', 'filters website URLs by domain_id' do
        schema APISchemas::WebsiteUrl.list_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:domain_id) { domain1_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['website_urls'].length).to eq(2)
          data['website_urls'].each do |url|
            expect(url['domain_id']).to eq(domain1_owned.id)
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

  path '/api/v1/website_urls/search' do
    post 'Searches for website URL availability' do
      tags 'WebsiteUrls'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :search_params, in: :body, schema: APISchemas::WebsiteUrl.search_params_schema

      let!(:url1_owned) { create(:website_url, path: '/existing-page', account: user1_owned_account, website: website1_owned, domain: domain1_owned) }
      let!(:url2_other) { create(:website_url, path: '/other-page', account: user2_owned_account, website: website2_owned, domain: domain2_owned) }

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'returns availability statuses' do
        schema APISchemas::WebsiteUrl.search_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:search_params) do
          {
            domain_id: domain1_owned.id,
            candidates: [
              '/existing-page',
              '/new-page',
              '/another-new-page'
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data['domain_id']).to eq(domain1_owned.id)
          expect(data['domain']).to eq(domain1_owned.domain)

          results = data['results']

          # Existing URL owned by current account
          existing = results.find { |r| r['path'] == '/existing-page' }
          expect(existing['status']).to eq('existing')
          expect(existing['existing_id']).to eq(url1_owned.id)
          expect(existing['existing_website_id']).to eq(website1_owned.id)

          # Available URLs
          new_page = results.find { |r| r['path'] == '/new-page' }
          expect(new_page['status']).to eq('available')
          expect(new_page['existing_id']).to be_nil
          expect(new_page['existing_website_id']).to be_nil

          another_new = results.find { |r| r['path'] == '/another-new-page' }
          expect(another_new['status']).to eq('available')
        end
      end

      response '200', 'normalizes path inputs' do
        schema APISchemas::WebsiteUrl.search_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:search_params) do
          {
            domain_id: domain1_owned.id,
            candidates: [
              'existing-page',
              '  /new-page/  ',
              ''
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          results = data['results']

          # Should normalize to add leading slash
          existing = results.find { |r| r['path'] == '/existing-page' }
          expect(existing['status']).to eq('existing')

          # Should strip whitespace and trailing slashes
          new_page = results.find { |r| r['path'] == '/new-page' }
          expect(new_page['status']).to eq('available')

          # Empty string should normalize to root
          root = results.find { |r| r['path'] == '/' }
          expect(root['status']).to eq('available')
        end
      end

      response '404', 'domain not found' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:search_params) do
          {
            domain_id: 999999,
            candidates: ['/test']
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('Domain not found')
        end
      end

      response '404', 'domain belongs to another account' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:search_params) do
          {
            domain_id: domain2_owned.id,
            candidates: ['/test']
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('Domain not found')
        end
      end

      response '422', 'missing domain_id parameter' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:search_params) do
          {
            candidates: ['/test']
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('domain_id parameter is required')
        end
      end

      response '422', 'missing candidates parameter' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:search_params) do
          {
            domain_id: domain1_owned.id
          }
        end

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
            domain_id: domain1_owned.id,
            candidates: (1..11).map { |i| "/page#{i}" }
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
            domain_id: domain1_owned.id,
            candidates: ['/test']
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end

  path '/api/v1/website_urls/{id}' do
    parameter name: :id, in: :path, type: :integer, description: 'WebsiteUrl ID'

    get 'Retrieves a website URL' do
      tags 'WebsiteUrls'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      let!(:url1_owned) { create(:website_url, path: '/page1', account: user1_owned_account, website: website1_owned, domain: domain1_owned) }
      let!(:url1_team) { create(:website_url, path: '/team-page', account: user1_team_account, website: website1_team, domain: domain1_team) }
      let!(:url2_other) { create(:website_url, path: '/other-page', account: user2_owned_account, website: website2_owned, domain: domain2_owned) }

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'website URL found in owned account' do
        schema APISchemas::WebsiteUrl.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { url1_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(url1_owned.id)
          expect(data['path']).to eq('/page1')
        end
      end

      response '404', 'cannot access team account website URL from owned account' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { url1_team.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('Not found')
        end
      end

      response '404', 'cannot access other user website URL' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { url2_other.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('Not found')
        end
      end

      response '200', 'website URL found in team account after switching' do
        schema APISchemas::WebsiteUrl.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { url1_team.id }

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(url1_team.id)
          expect(data['path']).to eq('/team-page')
        end
      end
    end

    patch 'Updates a website URL' do
      tags 'WebsiteUrls'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :website_url_params, in: :body, schema: APISchemas::WebsiteUrl.params_schema

      let!(:url1_owned) { create(:website_url, path: '/original-path', account: user1_owned_account, website: website1_owned, domain: domain1_owned) }
      let!(:url1_team) { create(:website_url, path: '/team-path', account: user1_team_account, website: website1_team, domain: domain1_team) }
      let!(:url2_other) { create(:website_url, path: '/other-path', account: user2_owned_account, website: website2_owned, domain: domain2_owned) }

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'website URL updated successfully' do
        schema APISchemas::WebsiteUrl.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { url1_owned.id }
        let(:website_url_params) do
          {
            website_url: {
              domain_id: domain1_owned.id,
              website_id: website1_owned.id,
              path: '/updated-path'
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['path']).to eq('/updated-path')
          expect(data['id']).to eq(url1_owned.id)
        end
      end

      response '404', 'cannot update other user website URL' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { url2_other.id }
        let(:website_url_params) do
          {
            website_url: {
              domain_id: domain1_owned.id,
              website_id: website1_owned.id,
              path: '/hacked-path'
            }
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('Not found')
        end
      end

      response '422', 'duplicate domain and path on update' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { url1_owned.id }
        let(:website_url_params) do
          {
            website_url: {
              domain_id: domain1_owned.id,
              website_id: website1_owned.id,
              path: '/existing-path'
            }
          }
        end

        before do
          create(:website_url, domain: domain1_owned, website: website1_owned, account: user1_owned_account, path: '/existing-path')
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']).to include('A website URL with this domain and path already exists')
        end
      end

      response '200', 'website URL updated in team account after switching' do
        schema APISchemas::WebsiteUrl.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { url1_team.id }
        let(:website_url_params) do
          {
            website_url: {
              domain_id: domain1_team.id,
              website_id: website1_team.id,
              path: '/updated-team-path'
            }
          }
        end

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['path']).to eq('/updated-team-path')
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:id) { url1_owned.id }
        let(:website_url_params) do
          {
            website_url: {
              domain_id: domain1_owned.id,
              website_id: website1_owned.id,
              path: '/test'
            }
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end
end
