# frozen_string_literal: true

require "swagger_helper"

RSpec.describe "Agent Context Events API", type: :request do
  let(:user) { create(:user) }
  let(:account) { user.owned_account }
  let(:project) { create(:project, account: account) }

  path "/api/v1/agent_context_events" do
    get "Lists context events for a project" do
      tags "Agent Context Events"
      produces "application/json"
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :project_id, in: :query, type: :integer, required: true, description: "Project ID to fetch events for"
      parameter name: "event_types[]", in: :query, type: :array, items: {type: :string}, required: false, description: "Filter by event types"
      parameter name: :since, in: :query, type: :string, format: "date-time", required: false, description: "ISO8601 timestamp to filter events after"

      response "200", "returns events for the specified project" do
        schema APISchemas::AgentContextEvent.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { project.id }

        before do
          ActsAsTenant.with_tenant(account) do
            create(:agent_context_event, account: account, project: project, event_type: "images.created", created_at: 2.hours.ago)
            create(:agent_context_event, account: account, project: project, event_type: "images.deleted", created_at: 1.minute.ago)
          end
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json.length).to eq(2)
          expect(json.map { |e| e["event_type"] }).to contain_exactly("images.created", "images.deleted")
        end
      end

      response "200", "filters events by event_types" do
        schema APISchemas::AgentContextEvent.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { project.id }
        let(:"event_types[]") { ["images.deleted"] }

        before do
          ActsAsTenant.with_tenant(account) do
            create(:agent_context_event, account: account, project: project, event_type: "images.created", created_at: 2.hours.ago)
            create(:agent_context_event, account: account, project: project, event_type: "images.deleted", created_at: 1.minute.ago)
          end
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json.length).to eq(1)
          expect(json.first["event_type"]).to eq("images.deleted")
        end
      end

      response "200", "filters events by since timestamp" do
        schema APISchemas::AgentContextEvent.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { project.id }
        let(:since) { 1.hour.ago.iso8601 }

        before do
          ActsAsTenant.with_tenant(account) do
            create(:agent_context_event, account: account, project: project, event_type: "images.created", created_at: 2.hours.ago)
            create(:agent_context_event, account: account, project: project, event_type: "images.deleted", created_at: 1.minute.ago)
          end
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json.length).to eq(1)
          expect(json.first["event_type"]).to eq("images.deleted")
        end
      end

      response "200", "returns events in chronological order" do
        schema APISchemas::AgentContextEvent.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { project.id }

        before do
          ActsAsTenant.with_tenant(account) do
            create(:agent_context_event, account: account, project: project, event_type: "images.created", created_at: 2.hours.ago)
            create(:agent_context_event, account: account, project: project, event_type: "images.deleted", created_at: 1.minute.ago)
          end
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          timestamps = json.map { |e| Time.parse(e["created_at"]) }
          expect(timestamps).to eq(timestamps.sort)
        end
      end

      response "200", "includes event payload" do
        schema APISchemas::AgentContextEvent.list_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { project.id }

        before do
          ActsAsTenant.with_tenant(account) do
            create(:agent_context_event,
              account: account,
              project: project,
              event_type: "images.created",
              payload: {upload_id: 123, filename: "test.jpg"})
          end
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          event = json.first
          expect(event["payload"]["upload_id"]).to eq(123)
          expect(event["payload"]["filename"]).to eq("test.jpg")
        end
      end

      response "400", "missing project_id" do
        schema APISchemas.error_response
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { nil }

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("project_id is required")
        end
      end

      response "404", "project not found" do
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { 999999 }

        run_test!
      end

      response "404", "cannot access another account's project" do
        let(:other_user) { create(:user) }
        let(:other_account) { other_user.owned_account }
        let(:other_project) { create(:project, account: other_account) }
        let(:auth_headers) { auth_headers_for(user) }
        let(:Authorization) { auth_headers["Authorization"] }
        let(:"X-Signature") { auth_headers["X-Signature"] }
        let(:"X-Timestamp") { auth_headers["X-Timestamp"] }
        let(:project_id) { other_project.id }

        run_test!
      end

      response "401", "unauthorized - missing token" do
        let(:project_id) { project.id }
        let(:Authorization) { nil }

        run_test!
      end

      response "401", "unauthorized - invalid token" do
        let(:project_id) { project.id }
        let(:Authorization) { "Bearer invalid_token" }

        run_test!
      end
    end
  end
end
