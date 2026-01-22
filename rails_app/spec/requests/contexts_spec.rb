require 'swagger_helper'

RSpec.describe "Context API", type: :request do
  let!(:template) { create(:template) }
  let!(:theme) { create(:theme) }

  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_owned_account) { user1.owned_account }
  let!(:user2_owned_account) { user2.owned_account }

  let!(:project1) { create(:project, account: user1_owned_account, name: "Project 1") }
  let!(:website1) { create(:website, account: user1_owned_account, project: project1, template: template, theme: theme) }
  let!(:brainstorm1) { create(:brainstorm, website: website1, idea: "Test idea", audience: "Test audience", solution: "Test solution", social_proof: "Test proof") }

  let!(:upload1) { create(:upload, account: user1_owned_account, is_logo: true) }
  let!(:upload2) { create(:upload, account: user1_owned_account, is_logo: false) }

  before do
    ensure_plans_exist
    subscribe_account(user1_owned_account, plan_name: "growth_monthly")
    subscribe_account(user2_owned_account, plan_name: "growth_monthly")

    # Associate uploads with website
    website1.uploads << upload1
    website1.uploads << upload2
  end

  path '/api/v1/websites/{website_id}/context' do
    get 'Retrieves context for a website' do
      tags 'Context'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :website_id, in: :path, type: :integer, required: true, description: 'Website ID'

      response '200', 'returns context with brainstorm, uploads, and theme' do
        schema APISchemas::Context.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_id) { website1.id }

        run_test! do |response|
          data = JSON.parse(response.body)

          # Verify brainstorm
          expect(data["brainstorm"]).to be_present
          expect(data["brainstorm"]["id"]).to eq(brainstorm1.id)
          expect(data["brainstorm"]["idea"]).to eq("Test idea")
          expect(data["brainstorm"]["audience"]).to eq("Test audience")
          expect(data["brainstorm"]["solution"]).to eq("Test solution")
          expect(data["brainstorm"]["social_proof"]).to eq("Test proof")

          # Verify uploads have proper URLs (not just filenames)
          expect(data["uploads"]).to be_an(Array)
          expect(data["uploads"].length).to eq(2)
          data["uploads"].each do |upload|
            expect(upload["url"]).to be_present
            # URL should be a path or full URL, not just a UUID filename
            expect(upload["url"]).to match(%r{/uploads/})
          end

          # Verify theme
          expect(data["theme"]).to be_present
          expect(data["theme"]["id"]).to eq(theme.id)
          expect(data["theme"]["name"]).to eq(theme.name)
          expect(data["theme"]["colors"]).to be_an(Array)
        end
      end

      response '200', 'returns context without brainstorm when website has none' do
        let!(:project_no_brainstorm) { create(:project, account: user1_owned_account, name: "Project No Brainstorm") }
        let!(:website_no_brainstorm) { create(:website, account: user1_owned_account, project: project_no_brainstorm, template: template, theme: theme) }

        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_id) { website_no_brainstorm.id }

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["brainstorm"]).to be_nil
          expect(data["uploads"]).to eq([])
          expect(data["theme"]).to be_present
        end
      end

      response '404', 'website not found' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_id) { 999999 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Website not found")
        end
      end

      response '404', 'cannot access website owned by another account' do
        let!(:project2) { create(:project, account: user2_owned_account, name: "Project 2") }
        let!(:website2) { create(:website, account: user2_owned_account, project: project2, template: template) }

        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_id) { website2.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Website not found")
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:Authorization) { nil }
        let(:website_id) { website1.id }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end
  end
end
