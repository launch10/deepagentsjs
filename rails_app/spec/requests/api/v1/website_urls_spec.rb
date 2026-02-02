# frozen_string_literal: true

require "swagger_helper"

RSpec.describe "Website URLs API", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }
  let(:auth_headers) { auth_headers_for(user) }
  let(:Authorization) { auth_headers["Authorization"] }
  let(:"X-Signature") { auth_headers["X-Signature"] }
  let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
  end

  path "/api/v1/website_urls/search" do
    post "Searches for path availability on a domain" do
      tags "Website URLs", "Domains"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :body, in: :body, schema: APISchemas::WebsiteUrl.search_params_schema

      response "200", "returns available for unclaimed paths" do
        schema APISchemas::WebsiteUrl.search_response

        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let(:body) { {domain_id: domain.id, candidates: ["/landing", "/promo"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domain_id"]).to eq(domain.id)
          expect(json["domain"]).to eq(domain.domain)
          expect(json["results"]).to be_an(Array)
          expect(json["results"].length).to eq(2)
          expect(json["results"][0]["path"]).to eq("/landing")
          expect(json["results"][0]["status"]).to eq("available")
          expect(json["results"][0]["existing_id"]).to be_nil
          expect(json["results"][1]["path"]).to eq("/promo")
          expect(json["results"][1]["status"]).to eq("available")
        end
      end

      response "200", "returns existing for paths owned by current account" do
        schema APISchemas::WebsiteUrl.search_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let!(:website_url) { create(:website_url, account: account, website: website, domain: domain, path: "/landing") }
        let(:body) { {domain_id: domain.id, candidates: ["/landing"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["results"].length).to eq(1)
          expect(json["results"][0]["path"]).to eq("/landing")
          expect(json["results"][0]["status"]).to eq("existing")
          expect(json["results"][0]["existing_id"]).to eq(website_url.id)
          expect(json["results"][0]["existing_website_id"]).to eq(website.id)
        end
      end

      response "200", "returns mixed statuses for batch of candidates" do
        schema APISchemas::WebsiteUrl.search_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let!(:owned_url) { create(:website_url, account: account, website: website, domain: domain, path: "/owned") }

        let(:body) { {domain_id: domain.id, candidates: ["/new", "/owned"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["results"].length).to eq(2)

          # Available
          available = json["results"].find { |r| r["path"] == "/new" }
          expect(available["status"]).to eq("available")
          expect(available["existing_id"]).to be_nil

          # Existing (owned by current account)
          existing = json["results"].find { |r| r["path"] == "/owned" }
          expect(existing["status"]).to eq("existing")
          expect(existing["existing_id"]).to eq(owned_url.id)
          expect(existing["existing_website_id"]).to eq(website.id)
        end
      end

      # NOTE: The "unavailable" status (path owned by another account on the same domain)
      # is no longer testable because domain_belongs_to_account validation prevents
      # creating website_urls for domains owned by other accounts. The controller
      # code handles this case for any legacy data.

      response "200", "normalizes paths with leading slashes" do
        schema APISchemas::WebsiteUrl.search_response

        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let(:body) { {domain_id: domain.id, candidates: ["landing", "promo/"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["results"].length).to eq(2)
          # Both paths should be normalized to start with /
          expect(json["results"][0]["path"]).to eq("/landing")
          expect(json["results"][1]["path"]).to eq("/promo")
        end
      end

      response "200", "handles root path" do
        schema APISchemas::WebsiteUrl.search_response

        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let(:body) { {domain_id: domain.id, candidates: ["/", ""]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["results"].length).to eq(2)
          expect(json["results"][0]["path"]).to eq("/")
          expect(json["results"][1]["path"]).to eq("/")
        end
      end

      response "404", "returns not found for domain from another account" do
        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:other_domain) { create(:domain, :platform_subdomain, account: other_account) }
        let(:body) { {domain_id: other_domain.id, candidates: ["/landing"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Domain not found")
        end
      end

      response "404", "returns not found for non-existent domain" do
        let(:body) { {domain_id: 999999, candidates: ["/landing"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Domain not found")
        end
      end

      response "422", "rejects missing domain_id" do
        let(:body) { {candidates: ["/landing"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("domain_id parameter is required")
        end
      end

      response "422", "rejects empty candidates array" do
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let(:body) { {domain_id: domain.id, candidates: []} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("candidates parameter is required and must be an array")
        end
      end

      response "422", "rejects too many candidates" do
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let(:body) { {domain_id: domain.id, candidates: (1..15).map { |i| "/path-#{i}" }} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Maximum 10 candidates allowed")
        end
      end

      response "401", "unauthorized - missing token" do
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let(:body) { {domain_id: domain.id, candidates: ["/landing"]} }
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/website_urls" do
    get "Lists website URLs for the current account" do
      tags "Website URLs"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :website_id, in: :query, type: :integer, required: false,
        description: "Filter by website ID"
      parameter name: :domain_id, in: :query, type: :integer, required: false,
        description: "Filter by domain ID"

      response "200", "returns list of website URLs" do
        schema APISchemas::WebsiteUrl.list_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let!(:website_url) { create(:website_url, account: account, website: website, domain: domain, path: "/landing") }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["website_urls"]).to be_an(Array)
          expect(json["website_urls"].length).to eq(1)
          expect(json["website_urls"][0]["id"]).to eq(website_url.id)
          expect(json["website_urls"][0]["path"]).to eq("/landing")
        end
      end

      response "200", "filters by website_id" do
        schema APISchemas::WebsiteUrl.list_response

        let!(:website1) { create(:website, account: account, project: project) }
        let!(:other_project) { create(:project, account: account) }
        let!(:website2) { create(:website, account: account, project: other_project) }
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let!(:url1) { create(:website_url, account: account, website: website1, domain: domain, path: "/one") }
        let!(:url2) { create(:website_url, account: account, website: website2, domain: domain, path: "/two") }
        let(:website_id) { website1.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["website_urls"].length).to eq(1)
          expect(json["website_urls"][0]["id"]).to eq(url1.id)
        end
      end

      response "200", "filters by domain_id" do
        schema APISchemas::WebsiteUrl.list_response

        let!(:website1) { create(:website, account: account, project: project) }
        let!(:other_project) { create(:project, account: account) }
        let!(:website2) { create(:website, account: account, project: other_project) }
        let!(:domain1) { create(:domain, :platform_subdomain, account: account) }
        let!(:domain2) { create(:domain, :platform_subdomain, account: account) }
        let!(:url1) { create(:website_url, account: account, website: website1, domain: domain1, path: "/one") }
        let!(:url2) { create(:website_url, account: account, website: website2, domain: domain2, path: "/two") }
        let(:domain_id) { domain1.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["website_urls"].length).to eq(1)
          expect(json["website_urls"][0]["id"]).to eq(url1.id)
        end
      end

      response "200", "scopes to current account only" do
        schema APISchemas::WebsiteUrl.list_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let!(:my_url) { create(:website_url, account: account, website: website, domain: domain, path: "/mine") }

        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:other_project) { create(:project, account: other_account) }
        let!(:other_website) { create(:website, account: other_account, project: other_project) }
        let!(:other_domain) { create(:domain, :platform_subdomain, account: other_account) }
        let!(:other_url) { create(:website_url, account: other_account, website: other_website, domain: other_domain, path: "/other") }

        run_test! do |response|
          json = JSON.parse(response.body)
          url_ids = json["website_urls"].map { |u| u["id"] }
          expect(url_ids).to include(my_url.id)
          expect(url_ids).not_to include(other_url.id)
        end
      end

      response "401", "unauthorized - missing token" do
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
