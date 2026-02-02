# frozen_string_literal: true

require "swagger_helper"

RSpec.describe "Domain Context API", type: :request do
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

  path "/api/v1/websites/{website_id}/domain_context" do
    get "Returns domain context for subdomain picker" do
      tags "Websites", "Domains"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: true
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :website_id, in: :path, type: :integer, required: true

      response "200", "returns existing platform subdomains" do
        schema APISchemas::Context.domain_context_response

        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }
        let!(:platform_domain) { create(:domain, :platform_subdomain, account: account) }

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["existing_domains"]).to be_an(Array)
          expect(json["existing_domains"].length).to eq(1)

          domain_data = json["existing_domains"].first
          expect(domain_data["domain"]).to eq(platform_domain.domain)
          expect(domain_data["is_platform_subdomain"]).to be true
        end
      end

      response "200", "returns existing custom domains" do
        schema APISchemas::Context.domain_context_response

        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }
        let!(:custom_domain) { create(:domain, :custom_domain, account: account) }

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["existing_domains"]).to be_an(Array)
          expect(json["existing_domains"].length).to eq(1)

          domain_data = json["existing_domains"].first
          expect(domain_data["domain"]).to eq(custom_domain.domain)
          expect(domain_data["is_platform_subdomain"]).to be false
        end
      end

      response "200", "returns dns_verification_status for custom domains" do
        schema APISchemas::Context.domain_context_response

        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }
        let!(:custom_domain) { create(:domain, :custom_domain, account: account, dns_verification_status: "pending") }

        run_test! do |response|
          json = JSON.parse(response.body)

          domain_data = json["existing_domains"].find { |d| d["id"] == custom_domain.id }
          expect(domain_data).to be_present
          expect(domain_data["dns_verification_status"]).to eq("pending")
        end
      end

      response "200", "returns website associations with domains via website_urls" do
        schema APISchemas::Context.domain_context_response

        let!(:other_project) { create(:project, account: account, name: "Other Project") }
        let!(:other_website) { create(:website, name: "Other Site", account: account, project: other_project) }
        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }
        let!(:domain_with_url) { create(:domain, :platform_subdomain, account: account) }
        let!(:website_url) { create(:website_url, domain: domain_with_url, website: other_website, account: account, path: "/") }

        run_test! do |response|
          json = JSON.parse(response.body)

          domain_data = json["existing_domains"].find { |d| d["id"] == domain_with_url.id }
          expect(domain_data).to be_present
          expect(domain_data["website_urls"]).to be_an(Array)
          expect(domain_data["website_urls"].first["website_id"]).to eq(other_website.id)
        end
      end

      response "200", "returns website_urls for domains" do
        schema APISchemas::Context.domain_context_response

        let!(:other_project) { create(:project, account: account, name: "URL Project") }
        let!(:other_website) { create(:website, name: "Site With URLs", account: account, project: other_project) }
        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }
        let!(:domain) { create(:domain, :platform_subdomain, account: account) }
        let!(:website_url) { create(:website_url, domain: domain, website: other_website, account: account, path: "/landing") }

        run_test! do |response|
          json = JSON.parse(response.body)

          domain_data = json["existing_domains"].find { |d| d["id"] == domain.id }
          expect(domain_data["website_urls"]).to be_an(Array)
          expect(domain_data["website_urls"].length).to eq(1)
          expect(domain_data["website_urls"].first["path"]).to eq("/landing")
        end
      end

      response "200", "returns platform subdomain credits" do
        schema APISchemas::Context.domain_context_response

        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }
        let!(:existing_subdomain) { create(:domain, :platform_subdomain, account: account) }

        run_test! do |response|
          json = JSON.parse(response.body)

          credits = json["platform_subdomain_credits"]
          expect(credits).to be_a(Hash)
          expect(credits["limit"]).to eq(2) # growth plan has 2 subdomains
          expect(credits["used"]).to eq(1) # 1 existing subdomain
          expect(credits["remaining"]).to eq(1)
        end
      end

      response "200", "returns brainstorm context when present" do
        schema APISchemas::Context.domain_context_response

        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }
        let!(:brainstorm) do
          create(:brainstorm,
            website: website,
            idea: "A fitness app for busy professionals",
            audience: "Professionals aged 25-45",
            solution: "10-minute daily workout routines",
            social_proof: "Used by 500+ beta testers")
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          brainstorm_data = json["brainstorm_context"]
          expect(brainstorm_data).to be_a(Hash)
          expect(brainstorm_data["id"]).to eq(brainstorm.id)
          expect(brainstorm_data["idea"]).to eq("A fitness app for busy professionals")
          expect(brainstorm_data["audience"]).to eq("Professionals aged 25-45")
          expect(brainstorm_data["solution"]).to eq("10-minute daily workout routines")
          expect(brainstorm_data["social_proof"]).to eq("Used by 500+ beta testers")
        end
      end

      response "200", "returns null brainstorm_context when no brainstorm" do
        schema APISchemas::Context.domain_context_response

        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["brainstorm_context"]).to be_nil
        end
      end

      response "200", "scopes domains to user's account only" do
        schema APISchemas::Context.domain_context_response

        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }

        # Domains belonging to the current user's account
        let!(:my_domain) { create(:domain, :platform_subdomain, account: account) }

        # Domain belonging to another account (should not appear)
        let!(:other_domain) { create(:domain, :platform_subdomain, account: other_account) }

        run_test! do |response|
          json = JSON.parse(response.body)

          domain_ids = json["existing_domains"].map { |d| d["id"] }
          expect(domain_ids).to include(my_domain.id)
          expect(domain_ids).not_to include(other_domain.id)
        end
      end

      response "404", "returns not found when website doesn't exist" do
        let(:website_id) { 999999 }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Website not found")
        end
      end

      response "404", "returns not found when website belongs to different account" do
        let!(:other_user) { create(:user) }
        let!(:other_account) { other_user.owned_account }
        let!(:other_project) { create(:project, account: other_account) }
        let!(:other_website) { create(:website, account: other_account, project: other_project) }
        let(:website_id) { other_website.id }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Website not found")
        end
      end

      response "401", "unauthorized - missing token" do
        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }
        let(:Authorization) { nil }

        run_test!
      end

      response "401", "unauthorized - invalid token" do
        let!(:website) { create(:website, account: account, project: project) }
        let(:website_id) { website.id }
        let(:Authorization) { "Bearer invalid_token" }

        run_test!
      end
    end
  end
end
