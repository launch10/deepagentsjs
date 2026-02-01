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
end
