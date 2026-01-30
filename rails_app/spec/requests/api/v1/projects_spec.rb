# frozen_string_literal: true

require "swagger_helper"

RSpec.describe "Projects API", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: "growth_monthly")
  end

  # Helper to create projects with websites
  def create_project_with_website(account, name:, updated_at: Time.current)
    project = create(:project, account: account, name: name)
    create(:website, project: project)
    create(:project_workflow, project: project, workflow_type: "launch", step: "brainstorm")
    project.update_column(:updated_at, updated_at)
    project
  end

  path "/api/v1/projects" do
    get "Lists paginated projects" do
      tags "Projects"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :page, in: :query, type: :integer, required: false, description: "Page number (default 1)"
      parameter name: :status, in: :query, type: :string, required: false, description: "Filter by status (draft, paused, live)"

      response "200", "returns first page of projects with pagination metadata" do
        schema APISchemas::Project.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          # Create 7 projects with different updated_at timestamps
          7.times do |i|
            create_project_with_website(account, name: "Project #{i + 1}", updated_at: (7 - i).days.ago)
          end
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          # Should return 5 projects (PROJECTS_PER_PAGE)
          expect(json["projects"].length).to eq(5)

          # Should be ordered by updated_at DESC (most recent first)
          expect(json["projects"].first["name"]).to eq("Project 7")
          expect(json["projects"].last["name"]).to eq("Project 3")

          # Check pagination metadata
          expect(json["pagination"]["current_page"]).to eq(1)
          expect(json["pagination"]["total_pages"]).to eq(2)
          expect(json["pagination"]["total_count"]).to eq(7)
          expect(json["pagination"]["prev_page"]).to be_nil
          expect(json["pagination"]["next_page"]).to eq(2)
        end
      end

      response "200", "returns second page of projects" do
        schema APISchemas::Project.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:page) { 2 }

        before do
          7.times do |i|
            create_project_with_website(account, name: "Project #{i + 1}", updated_at: (7 - i).days.ago)
          end
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          # Should return 2 remaining projects
          expect(json["projects"].length).to eq(2)

          # Should be the oldest projects
          expect(json["projects"].first["name"]).to eq("Project 2")
          expect(json["projects"].last["name"]).to eq("Project 1")

          # Check pagination metadata
          expect(json["pagination"]["current_page"]).to eq(2)
          expect(json["pagination"]["prev_page"]).to eq(1)
          expect(json["pagination"]["next_page"]).to be_nil
        end
      end

      response "200", "returns last page when page exceeds total (overflow handling)" do
        schema APISchemas::Project.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:page) { 999 }

        before do
          3.times { |i| create_project_with_website(account, name: "Project #{i + 1}") }
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          # Pagy overflow is configured to return last page
          expect(json["projects"].length).to eq(3)
          expect(json["pagination"]["current_page"]).to eq(1)
        end
      end

      response "200", "filters by status" do
        schema APISchemas::Project.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:status) { "live" }

        before do
          2.times { |i| create_project_with_website(account, name: "Draft Project #{i + 1}") }
          3.times do |i|
            p = create_project_with_website(account, name: "Live Project #{i + 1}")
            p.update_column(:status, "live")
          end
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["projects"].length).to eq(3)
          expect(json["projects"].all? { |p| p["status"] == "live" }).to be true
          expect(json["pagination"]["total_count"]).to eq(3)
        end
      end

      response "200", "returns empty array when no projects exist" do
        schema APISchemas::Project.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        run_test! do |response|
          json = JSON.parse(response.body)

          expect(json["projects"]).to eq([])
          expect(json["pagination"]["total_count"]).to eq(0)
          # Pagy returns 1 as minimum total_pages even with 0 items
          expect(json["pagination"]["total_pages"]).to eq(1)
        end
      end

      response "200", "only returns projects for the authenticated user's account" do
        schema APISchemas::Project.list_response
        let(:other_user) { create(:user, name: "Other User") }
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          # Create projects for both accounts
          2.times { |i| create_project_with_website(account, name: "My Project #{i + 1}") }
          3.times { |i| create_project_with_website(other_user.owned_account, name: "Other Project #{i + 1}") }
        end

        run_test! do |response|
          json = JSON.parse(response.body)

          # Should only see own projects
          expect(json["projects"].length).to eq(2)
          expect(json["projects"].all? { |p| p["name"].start_with?("My Project") }).to be true
          expect(json["pagination"]["total_count"]).to eq(2)
        end
      end

      response "200", "returns project mini JSON with expected fields" do
        schema APISchemas::Project.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }

        before do
          create_project_with_website(account, name: "Test Project")
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          project = json["projects"].first

          expect(project).to have_key("id")
          expect(project).to have_key("uuid")
          expect(project).to have_key("website_id")
          expect(project).to have_key("account_id")
          expect(project).to have_key("name")
          expect(project).to have_key("status")
          expect(project).to have_key("domain")
          expect(project).to have_key("created_at")
          expect(project).to have_key("updated_at")
        end
      end

      response "401", "unauthorized - missing token" do
        let(:Authorization) { nil }

        run_test!
      end

      response "401", "unauthorized - invalid token" do
        let(:Authorization) { "Bearer invalid_token" }

        run_test!
      end

      response "401", "unauthorized - expired token" do
        let(:Authorization) { "Bearer #{expired_jwt_for(user)}" }

        run_test!
      end
    end
  end
end
