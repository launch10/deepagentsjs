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
        let!(:domain) { create(:domain, :platform_subdomain, account: account, website: website) }

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
        let!(:domain) { create(:domain, :platform_subdomain, account: account, website: website) }
        let!(:website_url) { create(:website_url, account: account, domain: domain, website: website, path: "/landing") }
        let(:include_website_urls) { true }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domains"][0]["website_urls"]).to be_an(Array)
          expect(json["domains"][0]["website_urls"].length).to eq(1)
          expect(json["domains"][0]["website_urls"][0]["path"]).to eq("/landing")
        end
      end

      response "200", "filters domains by website_id" do
        schema APISchemas::Domain.list_response

        let!(:website1) { create(:website, account: account, project: project) }
        let!(:other_project) { create(:project, account: account) }
        let!(:website2) { create(:website, account: account, project: other_project) }
        let!(:domain1) { create(:domain, :platform_subdomain, account: account, website: website1) }
        let!(:domain2) { create(:domain, :platform_subdomain, account: account, website: website2) }
        let(:website_id) { website1.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["domains"].length).to eq(1)
          expect(json["domains"][0]["id"]).to eq(domain1.id)
        end
      end

      response "401", "unauthorized - missing token" do
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/domains/{id}" do
    patch "Reassigns a domain to a different website" do
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
              website_id: {type: :integer}
            }
          }
        }
      }

      response "200", "successfully reassigns domain to new website" do
        schema APISchemas::Context.domain_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:other_project) { create(:project, account: account) }
        let!(:other_website) { create(:website, account: account, project: other_project) }
        let!(:domain) { create(:domain, :platform_subdomain, account: account, website: website) }
        let(:id) { domain.id }
        let(:body) { {domain: {website_id: other_website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["id"]).to eq(domain.id)
          expect(json["website_id"]).to eq(other_website.id)
          expect(domain.reload.website_id).to eq(other_website.id)
        end
      end

      response "200", "removes domain from website when website_id is nil" do
        schema APISchemas::Context.domain_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:domain) { create(:domain, :platform_subdomain, account: account, website: website) }
        let(:id) { domain.id }
        let(:body) { {domain: {website_id: nil}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["id"]).to eq(domain.id)
          expect(json["website_id"]).to be_nil
          expect(domain.reload.website_id).to be_nil
        end
      end

      response "404", "returns not found for domain belonging to another account" do
        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:other_project) { create(:project, account: other_account) }
        let!(:other_domain) { create(:domain, :platform_subdomain, account: other_account, website: nil) }
        let!(:website) { create(:website, account: account, project: project) }
        let(:id) { other_domain.id }
        let(:body) { {domain: {website_id: website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Not found")
        end
      end

      response "422", "cannot reassign to website belonging to another account" do
        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:other_project) { create(:project, account: other_account) }
        let!(:other_website) { create(:website, account: other_account, project: other_project) }
        let!(:domain) { create(:domain, :platform_subdomain, account: account, website: nil) }
        let(:id) { domain.id }
        let(:body) { {domain: {website_id: other_website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Website not found")
        end
      end

      response "404", "returns not found for non-existent domain" do
        let!(:website) { create(:website, account: account, project: project) }
        let(:id) { 999999 }
        let(:body) { {domain: {website_id: website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Not found")
        end
      end

      response "401", "unauthorized - missing token" do
        let!(:domain) { create(:domain, :platform_subdomain, account: account, website: nil) }
        let(:id) { domain.id }
        let(:body) { {domain: {website_id: nil}} }
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

        let!(:domain) { create(:domain, :platform_subdomain, account: account, website: nil) }
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

        let!(:domain) { create(:domain, :custom_domain, account: account, website: nil) }
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

        let!(:domain) { create(:domain, :custom_domain, account: account, website: nil) }
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
        let!(:other_domain) { create(:domain, :custom_domain, account: other_account, website: nil) }
        let(:id) { other_domain.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Domain not found")
        end
      end

      response "401", "unauthorized - missing token" do
        let!(:domain) { create(:domain, :custom_domain, account: account, website: nil) }
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
          # Idempotent - returns the existing domain and URL
          expect(json["domain"]["id"]).to eq(existing_domain.id)
          expect(json["website_url"]["id"]).to eq(existing_url.id)
          expect(json["website_url"]["path"]).to eq("/landing")
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

      response "201", "user switches from platform subdomain to custom domain" do
        schema APISchemas::Domain.create_response

        # User already has a platform subdomain with a path
        let!(:website) { create(:website, account: account, project: project) }
        let!(:existing_domain) { create(:domain, domain: "xyz.launch10.site", account: account, website: website) }
        let!(:existing_url) { create(:website_url, domain: existing_domain, website: website, account: account, path: "/pets") }

        # Now user wants to use a custom domain instead (pets.launch10.ai already has subdomain, no www added)
        let(:body) { {domain: {domain: "pets.launch10.ai", website_id: website.id, is_platform_subdomain: false}} }

        run_test! do |response|
          json = JSON.parse(response.body)

          # Custom domain should be created (subdomain domains don't get www prefix)
          expect(json["domain"]["domain"]).to eq("pets.launch10.ai")
          expect(json["domain"]["is_platform_subdomain"]).to eq(false)
          expect(json["domain"]["website_id"]).to eq(website.id)

          # WebsiteUrl should be created for the new domain
          expect(json["website_url"]["path"]).to eq("/")
          expect(json["website_url"]["website_id"]).to eq(website.id)

          # Only the new domain should be linked to website
          expect(website.domains.count).to eq(1)
          expect(website.domains.first.domain).to eq("pets.launch10.ai")

          # Website should have exactly one website_url (the new one)
          expect(website.website_urls.count).to eq(1)
          expect(website.website_urls.first.domain.domain).to eq("pets.launch10.ai")

          # Old domain should be KEPT but unlinked (website_id=nil)
          old_domain = Domain.find_by(domain: "xyz.launch10.site")
          expect(old_domain).to be_present
          expect(old_domain.website_id).to be_nil
          expect(old_domain.account_id).to eq(account.id)

          # Old website_url should be deleted
          expect(WebsiteUrl.find_by(id: existing_url.id)).to be_nil
        end
      end

      response "201", "unlinks old domain when creating new one for same website" do
        schema APISchemas::Domain.create_response

        let!(:website) { create(:website, account: account, project: project) }
        let!(:existing_domain) { create(:domain, domain: "existing.launch10.site", account: account, website: website) }
        let!(:existing_url) { create(:website_url, domain: existing_domain, website: website, account: account, path: "/") }

        # Create a completely different custom domain
        let(:body) { {domain: {domain: "newcustom.com", website_id: website.id}} }

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["domain"]["domain"]).to eq("www.newcustom.com")
          expect(json["domain"]["is_platform_subdomain"]).to eq(false)
          expect(json["website_url"]["website_id"]).to eq(website.id)

          # New domain should exist and be linked to website
          new_domain = Domain.find_by(domain: "www.newcustom.com")
          expect(new_domain).to be_present
          expect(new_domain.website_id).to eq(website.id)

          # Old domain should be KEPT but unlinked (website_id=nil)
          old_domain = Domain.find_by(domain: "existing.launch10.site")
          expect(old_domain).to be_present
          expect(old_domain.website_id).to be_nil
          expect(old_domain.account_id).to eq(account.id)

          # Old website_url should be deleted
          expect(WebsiteUrl.find_by(id: existing_url.id)).to be_nil

          # Website should have only one domain and one website_url
          expect(website.domains.count).to eq(1)
          expect(website.website_urls.count).to eq(1)
          expect(website.website_urls.first.domain.domain).to eq("www.newcustom.com")
        end
      end
    end
  end
end
