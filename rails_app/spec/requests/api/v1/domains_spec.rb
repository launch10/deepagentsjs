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
end
