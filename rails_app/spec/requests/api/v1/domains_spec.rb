# frozen_string_literal: true

require "swagger_helper"

RSpec.describe "Domains API", type: :request do
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

  path "/api/v1/domains" do
    get "Lists all domains for the current account" do
      tags "Domains"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :website_id, in: :query, type: :integer, required: false,
        description: "Filter domains by website ID"
      parameter name: :include_website_urls, in: :query, type: :boolean, required: false,
        description: "Include website_urls for each domain"

      response "200", "returns list of domains" do
        schema APISchemas::Domain.list_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domains"]).to be_an(Array)
          expect(json["domains"].length).to eq(1)
          expect(json["domains"][0]["id"]).to eq(domain.id)
          expect(json["platform_subdomain_credits"]).to be_present
          expect(json["platform_subdomain_credits"]["limit"]).to eq(2) # growth plan
          expect(json["plan_tier"]).to eq("growth")
        end
      end

      response "200", "returns domains with website_urls when requested" do
        schema APISchemas::Domain.list_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let!(:website_url) { create(:website_url, account: account, website: website, domain: domain, path: "/landing") }
        let(:include_website_urls) { true }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domains"][0]["website_urls"]).to be_an(Array)
          expect(json["domains"][0]["website_urls"].length).to eq(1)
          expect(json["domains"][0]["website_urls"][0]["path"]).to eq("/landing")
        end
      end

      response "200", "returns all domains for account (website_id filter removed)" do
        schema APISchemas::Domain.list_response

        let!(:website1) { create(:website, account: account, project: project) }
        let!(:other_project) { create(:project, account: account) }
        let!(:website2) { create(:website, account: account, project: other_project) }
        let!(:domain1) { create(:domain, :platform_subdomain, account: account) }
        let!(:domain2) { create(:domain, :platform_subdomain, account: account) }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domains"].length).to eq(2)
        end
      end

      response "401", "unauthorized - missing token" do
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/domains/search" do
    post "Searches for domain availability" do
      tags "Domains"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          candidates: {type: :array, items: {type: :string}}
        },
        required: [:candidates]
      }

      response "200", "returns available for unclaimed subdomains" do
        let(:body) { {candidates: ["brand-new.launch10.site", "another-new.launch10.site"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["results"]).to be_an(Array)
          expect(json["results"].length).to eq(2)
          expect(json["results"][0]["domain"]).to eq("brand-new.launch10.site")
          expect(json["results"][0]["status"]).to eq("available")
          expect(json["results"][0]["existing_id"]).to be_nil
          expect(json["results"][1]["status"]).to eq("available")
          expect(json["platform_subdomain_credits"]).to be_present
        end
      end

      response "200", "returns existing for account-owned subdomains" do
        let!(:owned_domain) { create(:domain, domain: "my-owned.launch10.site", account: account) }
        let(:body) { {candidates: ["my-owned.launch10.site"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["results"].length).to eq(1)
          expect(json["results"][0]["domain"]).to eq("my-owned.launch10.site")
          expect(json["results"][0]["status"]).to eq("existing")
          expect(json["results"][0]["existing_id"]).to eq(owned_domain.id)
        end
      end

      response "200", "returns unavailable for other-account subdomains" do
        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:other_domain) { create(:domain, domain: "taken-by-other.launch10.site", account: other_account) }
        let(:body) { {candidates: ["taken-by-other.launch10.site"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["results"].length).to eq(1)
          expect(json["results"][0]["domain"]).to eq("taken-by-other.launch10.site")
          expect(json["results"][0]["status"]).to eq("unavailable")
          expect(json["results"][0]["existing_id"]).to be_nil
        end
      end

      response "200", "returns mixed statuses for batch of candidates" do
        let!(:owned_domain) { create(:domain, domain: "my-owned.launch10.site", account: account) }
        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:other_domain) { create(:domain, domain: "taken-by-other.launch10.site", account: other_account) }
        let(:body) { {candidates: ["brand-new.launch10.site", "my-owned.launch10.site", "taken-by-other.launch10.site"]} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["results"].length).to eq(3)

          # Available
          available = json["results"].find { |r| r["domain"] == "brand-new.launch10.site" }
          expect(available["status"]).to eq("available")
          expect(available["existing_id"]).to be_nil

          # Existing (owned by current account)
          existing = json["results"].find { |r| r["domain"] == "my-owned.launch10.site" }
          expect(existing["status"]).to eq("existing")
          expect(existing["existing_id"]).to eq(owned_domain.id)

          # Unavailable (owned by another account)
          unavailable = json["results"].find { |r| r["domain"] == "taken-by-other.launch10.site" }
          expect(unavailable["status"]).to eq("unavailable")
          expect(unavailable["existing_id"]).to be_nil
        end
      end

      response "422", "rejects empty candidates array" do
        let(:body) { {candidates: []} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("candidates parameter is required and must be an array")
        end
      end

      response "422", "rejects too many candidates" do
        let(:body) { {candidates: (1..15).map { |i| "test-#{i}.launch10.site" }} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Maximum 10 candidates allowed")
        end
      end

      response "401", "unauthorized - missing token" do
        let(:body) { {candidates: ["test.launch10.site"]} }
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/domains/{id}" do
    patch "Updates domain DNS verification status" do
      tags "Domains"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :id, in: :path, type: :integer, required: true
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          domain: {
            type: :object,
            properties: {
              dns_verification_status: {type: :string}
            }
          }
        }
      }

      response "200", "successfully updates dns_verification_status" do
        schema APISchemas::Context.domain_response

        let!(:domain) { create(:domain, :custom_domain, account: account, dns_verification_status: "pending") }
        let(:id) { domain.id }
        let(:body) { {domain: {dns_verification_status: "verified"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["id"]).to eq(domain.id)
          expect(json["dns_verification_status"]).to eq("verified")
          expect(domain.reload.dns_verification_status).to eq("verified")
        end
      end

      response "404", "returns not found for domain belonging to another account" do
        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:other_domain) { create(:domain, :platform_subdomain, account: other_account) }
        let(:id) { other_domain.id }
        let(:body) { {domain: {dns_verification_status: "verified"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Not found")
        end
      end

      response "404", "returns not found for non-existent domain" do
        let(:id) { 999999 }
        let(:body) { {domain: {dns_verification_status: "verified"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Not found")
        end
      end

      response "401", "unauthorized - missing token" do
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let(:id) { domain.id }
        let(:body) { {domain: {dns_verification_status: "verified"}} }
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/domains/{id}/verify_dns" do
    post "Verifies DNS configuration for a custom domain" do
      tags "Domains"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :id, in: :path, type: :integer, required: true

      response "200", "returns verified status for platform subdomains" do
        schema APISchemas::Domain.verify_dns_response

        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let(:id) { domain.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domain_id"]).to eq(domain.id)
          expect(json["domain"]).to eq(domain.domain)
          expect(json["verification_status"]).to eq("verified")
          expect(json["expected_cname"]).to be_nil
          expect(json["actual_cname"]).to be_nil
        end
      end

      response "200", "verifies DNS for custom domain" do
        schema APISchemas::Domain.verify_dns_response

        let!(:domain) { create(:domain, :custom_domain, account: account) }
        let(:id) { domain.id }

        before do
          allow_any_instance_of(Domains::DnsVerificationService).to receive(:lookup_cname)
            .and_return("cname.launch10.ai")
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domain_id"]).to eq(domain.id)
          expect(json["verification_status"]).to eq("verified")
          expect(json["expected_cname"]).to eq("cname.launch10.ai")
          expect(json["actual_cname"]).to eq("cname.launch10.ai")
          expect(json["last_checked_at"]).to be_present
        end
      end

      response "200", "returns pending status when CNAME not configured" do
        schema APISchemas::Domain.verify_dns_response

        let!(:domain) { create(:domain, :custom_domain, account: account) }
        let(:id) { domain.id }

        before do
          allow_any_instance_of(Domains::DnsVerificationService).to receive(:lookup_cname)
            .and_return(nil)
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["verification_status"]).to eq("pending")
          expect(json["error_message"]).to include("Expected cname.launch10.ai")
        end
      end

      response "404", "returns not found for non-existent domain" do
        let(:id) { 999999 }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Domain not found")
        end
      end

      response "404", "returns not found for domain belonging to another account" do
        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:other_domain) { create(:domain, :custom_domain, account: other_account) }
        let(:id) { other_domain.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Domain not found")
        end
      end

      response "401", "unauthorized - missing token" do
        let!(:domain) { create(:domain, :custom_domain, account: account) }
        let(:id) { domain.id }
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/domains" do
    post "Creates a domain and website URL" do
      tags "Domains"
      consumes "application/json"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          domain: {
            type: :object,
            properties: {
              domain: {type: :string},
              website_id: {type: :integer},
              path: {type: :string},
              is_platform_subdomain: {type: :boolean}
            },
            required: [:domain, :website_id]
          }
        }
      }

      response "201", "successfully creates a platform subdomain when under limit" do
        schema APISchemas::Domain.create_response

        let!(:website) { create(:website, account: account, project: project) }
        let(:body) { {domain: {domain: "mysite.launch10.site", website_id: website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domain"]["domain"]).to eq("mysite.launch10.site")
          expect(json["domain"]["is_platform_subdomain"]).to eq(true)
          expect(json["website_url"]["path"]).to eq("/")
          expect(json["website_url"]["website_id"]).to eq(website.id)
          expect(json["platform_subdomain_credits"]).to be_present
        end
      end

      response "201", "successfully creates a custom domain" do
        schema APISchemas::Domain.create_response

        let!(:website) { create(:website, account: account, project: project) }
        let(:body) { {domain: {domain: "mycustom.com", website_id: website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domain"]["domain"]).to eq("www.mycustom.com") # normalized
          expect(json["domain"]["is_platform_subdomain"]).to eq(false)
          expect(json["website_url"]["path"]).to eq("/")
        end
      end

      response "201", "creates website_url for existing domain owned by account" do
        schema APISchemas::Domain.create_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:existing_domain) { create(:domain, domain: "mysite.launch10.site", account: account) }
        let(:body) { {domain: {domain: "mysite.launch10.site", website_id: website.id, path: "/landing"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domain"]["id"]).to eq(existing_domain.id)
          expect(json["domain"]["domain"]).to eq("mysite.launch10.site")
          expect(json["website_url"]["path"]).to eq("/landing")
          expect(json["website_url"]["domain_id"]).to eq(existing_domain.id)
        end
      end

      response "422", "rejects platform subdomain when at limit" do
        # Use starter plan which has limit of 1
        before do
          # Re-subscribe to starter plan (limit of 1 subdomain)
          subscribe_account(account, plan_name: "starter_monthly")
          # Create one domain to hit the limit
          create(:domain, :platform_subdomain, account: account)
        end

        let!(:website) { create(:website, account: account, project: project) }
        let(:body) { {domain: {domain: "another.launch10.site", website_id: website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("You have reached the maximum number of platform subdomains for your plan")
        end
      end

      response "201", "still allows custom domain when at platform subdomain limit" do
        schema APISchemas::Domain.create_response

        before do
          # Re-subscribe to starter plan (limit of 1 subdomain)
          subscribe_account(account, plan_name: "starter_monthly")
          # Create one domain to hit the limit
          create(:domain, :platform_subdomain, account: account)
        end

        let!(:website) { create(:website, account: account, project: project) }
        let(:body) { {domain: {domain: "mycustom.com", website_id: website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domain"]["domain"]).to eq("www.mycustom.com")
          expect(json["domain"]["is_platform_subdomain"]).to eq(false)
        end
      end

      response "422", "rejects domain owned by another account" do
        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:website) { create(:website, account: account, project: project) }
        let!(:other_domain) { create(:domain, domain: "taken.launch10.site", account: other_account) }
        let(:body) { {domain: {domain: "taken.launch10.site", website_id: website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("This domain is not available")
        end
      end

      response "422", "rejects when website not found" do
        let(:body) { {domain: {domain: "mysite.launch10.site", website_id: 999999}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Website not found")
        end
      end

      response "422", "rejects restricted domains" do
        let!(:website) { create(:website, account: account, project: project) }
        let(:body) { {domain: {domain: "uploads.launch10.ai", website_id: website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Domain is restricted")
        end
      end

      response "201", "creates with custom path" do
        schema APISchemas::Domain.create_response

        let!(:website) { create(:website, account: account, project: project) }
        let(:body) { {domain: {domain: "mysite.launch10.site", website_id: website.id, path: "/pricing"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["website_url"]["path"]).to eq("/pricing")
        end
      end

      response "201", "is idempotent for existing domain+path combination" do
        schema APISchemas::Domain.create_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:existing_domain) { create(:domain, domain: "mysite.launch10.site", account: account) }
        let!(:existing_url) { create(:website_url, domain: existing_domain, website: website, account: account, path: "/landing") }
        let(:body) { {domain: {domain: "mysite.launch10.site", website_id: website.id, path: "/landing"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          # Idempotent - returns the existing domain and URL with same ID (update-in-place)
          expect(json["domain"]["id"]).to eq(existing_domain.id)
          expect(json["website_url"]["id"]).to eq(existing_url.id)
          expect(json["website_url"]["path"]).to eq("/landing")
        end
      end

      response "201", "reuses existing WebsiteUrl when changing path (update-in-place)" do
        schema APISchemas::Domain.create_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:existing_domain) { create(:domain, domain: "mysite.launch10.site", account: account) }
        let!(:existing_url) { create(:website_url, domain: existing_domain, website: website, account: account, path: "/") }
        # Same domain, different path - should update existing WebsiteUrl
        let(:body) { {domain: {domain: "mysite.launch10.site", website_id: website.id, path: "/pricing"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          # Same WebsiteUrl ID - no churn!
          expect(json["website_url"]["id"]).to eq(existing_url.id)
          expect(json["website_url"]["path"]).to eq("/pricing")
          expect(website.reload.website_url.id).to eq(existing_url.id)
          # Verify no additional WebsiteUrl records were created
          expect(WebsiteUrl.where(website: website).count).to eq(1)
        end
      end

      response "201", "reuses existing WebsiteUrl when assigning different domain (update-in-place)" do
        schema APISchemas::Domain.create_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:domain1) { create(:domain, domain: "first.launch10.site", account: account) }
        let!(:existing_url) { create(:website_url, domain: domain1, website: website, account: account, path: "/") }
        # Different domain - should update existing WebsiteUrl, not create new
        let(:body) { {domain: {domain: "second.launch10.site", website_id: website.id, path: "/"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          # Same WebsiteUrl ID - no churn!
          expect(json["website_url"]["id"]).to eq(existing_url.id)
          expect(website.reload.website_url.id).to eq(existing_url.id)
          # Verify no additional WebsiteUrl records were created
          expect(WebsiteUrl.where(website: website).count).to eq(1)
        end
      end

      response "201", "allows adding path to existing domain even at subdomain limit" do
        schema APISchemas::Domain.create_response

        before do
          # Re-subscribe to starter plan (limit of 1 subdomain)
          subscribe_account(account, plan_name: "starter_monthly")
        end

        # Create the domain that fills the limit
        let!(:existing_domain) { create(:domain, :platform_subdomain, account: account) }
        let!(:website) { create(:website, account: account, project: project) }
        # Adding a new path to existing domain should NOT count against the limit
        let(:body) { {domain: {domain: existing_domain.domain, website_id: website.id, path: "/new-page"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domain"]["id"]).to eq(existing_domain.id)
          expect(json["website_url"]["path"]).to eq("/new-page")
          # Verify we're still at 1 used (not 2)
          expect(json["platform_subdomain_credits"]["used"]).to eq(1)
        end
      end

      response "401", "unauthorized - missing token" do
        let(:body) { {domain: {domain: "test.launch10.site"}} }
        let(:Authorization) { nil }

        run_test!
      end

      response "201", "assigning EXISTING domain does not decrement credits" do
        schema APISchemas::Domain.create_response

        let!(:website) { create(:website, account: account, project: project) }
        # Already owned domain - assigning this should NOT use a credit
        let!(:existing_domain) { create(:domain, domain: "already-owned.launch10.site", account: account) }
        let(:body) { {domain: {domain: "already-owned.launch10.site", website_id: website.id}} }

        before do
          # Subscribe to starter plan with limit of 1
          subscribe_account(account, plan_name: "starter_monthly")
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domain"]["id"]).to eq(existing_domain.id)
          # Used count should remain 1 (the existing domain), not 2
          expect(json["platform_subdomain_credits"]["used"]).to eq(1)
          expect(json["platform_subdomain_credits"]["remaining"]).to eq(0)
          # Verify only 1 platform subdomain exists
          expect(account.domains.platform_subdomains.count).to eq(1)
        end
      end

      response "201", "allows same domain with different paths on different websites" do
        schema APISchemas::Domain.create_response

        let!(:website1) { create(:website, account: account, project: project) }
        let!(:other_project) { create(:project, account: account) }
        let!(:website2) { create(:website, account: account, project: other_project) }
        let!(:shared_domain) { create(:domain, domain: "shared.launch10.site", account: account) }
        # Website1 already has /landing
        let!(:url1) { create(:website_url, domain: shared_domain, website: website1, account: account, path: "/landing") }
        # Assign /promo to website2 - should succeed
        let(:body) { {domain: {domain: "shared.launch10.site", website_id: website2.id, path: "/promo"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domain"]["id"]).to eq(shared_domain.id)
          expect(json["website_url"]["path"]).to eq("/promo")
          expect(json["website_url"]["website_id"]).to eq(website2.id)

          # Both paths should exist
          expect(WebsiteUrl.where(domain: shared_domain).count).to eq(2)
          expect(website1.reload.website_url.path).to eq("/landing")
          expect(website2.reload.website_url.path).to eq("/promo")
        end
      end

      response "422", "rejects duplicate domain+path combination on different website" do
        let!(:website1) { create(:website, account: account, project: project) }
        let!(:other_project) { create(:project, account: account) }
        let!(:website2) { create(:website, account: account, project: other_project) }
        let!(:shared_domain) { create(:domain, domain: "shared.launch10.site", account: account) }
        # Website1 already has /landing
        let!(:url1) { create(:website_url, domain: shared_domain, website: website1, account: account, path: "/landing") }
        # Try to assign /landing to website2 - should fail (duplicate domain+path)
        let(:body) { {domain: {domain: "shared.launch10.site", website_id: website2.id, path: "/landing"}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to be_present
          expect(json["errors"].first).to include("path")
        end
      end

      response "201", "user switches from platform subdomain to custom domain" do
        schema APISchemas::Domain.create_response

        # User already has a platform subdomain with a path assigned to a different website_url
        let!(:website) { create(:website, account: account, project: project) }
        let!(:existing_domain) { create(:domain, domain: "xyz.launch10.site", account: account) }
        let!(:other_project) { create(:project, account: account) }
        let!(:other_website) { create(:website, account: account, project: other_project) }
        let!(:existing_url) { create(:website_url, domain: existing_domain, website: other_website, account: account, path: "/pets") }

        # Now user wants to use a custom domain for their website (pets.launch10.ai already has subdomain, no www added)
        let(:body) { {domain: {domain: "pets.launch10.ai", website_id: website.id, is_platform_subdomain: false}} }

        run_test! do |response|
          json = JSON.parse(response.body)

          # Custom domain should be created (subdomain domains don't get www prefix)
          expect(json["domain"]["domain"]).to eq("pets.launch10.ai")
          expect(json["domain"]["is_platform_subdomain"]).to eq(false)

          # WebsiteUrl should be created for the new domain
          expect(json["website_url"]["path"]).to eq("/")
          expect(json["website_url"]["website_id"]).to eq(website.id)

          # Website should have exactly one website_url (the new one)
          expect(website.reload.website_url).to be_present
          expect(website.website_url.domain.domain).to eq("pets.launch10.ai")

          # Old domain should still exist (owned by account)
          old_domain = Domain.find_by(domain: "xyz.launch10.site")
          expect(old_domain).to be_present
          expect(old_domain.account_id).to eq(account.id)

          # Old website_url for other_website should still exist
          expect(WebsiteUrl.find_by(id: existing_url.id)).to be_present
        end
      end

      response "201", "updates existing website_url to new domain (update-in-place)" do
        schema APISchemas::Domain.create_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:existing_domain) { create(:domain, domain: "existing.launch10.site", account: account) }
        let!(:existing_url) { create(:website_url, domain: existing_domain, website: website, account: account, path: "/") }

        # Create a completely different custom domain for the same website
        let(:body) { {domain: {domain: "newcustom.com", website_id: website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["domain"]["domain"]).to eq("www.newcustom.com")
          expect(json["domain"]["is_platform_subdomain"]).to eq(false)
          expect(json["website_url"]["website_id"]).to eq(website.id)

          # New domain should exist
          new_domain = Domain.find_by(domain: "www.newcustom.com")
          expect(new_domain).to be_present

          # Old domain should still exist (owned by account)
          old_domain = Domain.find_by(domain: "existing.launch10.site")
          expect(old_domain).to be_present
          expect(old_domain.account_id).to eq(account.id)

          # Website should have exactly one website_url (update-in-place pattern)
          # The same WebsiteUrl record is updated, not destroyed and recreated
          expect(website.reload.website_url).to be_present
          expect(website.website_url.id).to eq(existing_url.id) # Same ID - no churn!
          expect(website.website_url.domain.domain).to eq("www.newcustom.com")
        end
      end
    end
  end

  describe "event tracking" do
    let(:auth_headers) { auth_headers_for(user) }
    let!(:website) { create(:website, account: account, project: project) }

    it "tracks domain_configured on successful create" do
      expect(TrackEvent).to receive(:call).with("domain_configured",
        hash_including(domain_type: kind_of(String), domain_name: kind_of(String)))
      post "/api/v1/domains",
        params: { domain: { domain: "tracked-site.launch10.site", website_id: website.id } },
        headers: auth_headers,
        as: :json
    end
  end
end
