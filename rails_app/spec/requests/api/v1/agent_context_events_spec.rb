require "rails_helper"

RSpec.describe "API::V1::AgentContextEvents", type: :request do
  let(:user) { create(:user) }
  let(:account) { user.owned_account }
  let(:project) { create(:project, account: account) }

  let(:auth_headers) { auth_headers_for(user) }

  before do
    # Create some test events
    ActsAsTenant.with_tenant(account) do
      create(:agent_context_event, account: account, project: project, event_type: "images.created", created_at: 2.hours.ago)
      create(:agent_context_event, account: account, project: project, event_type: "images.deleted", created_at: 1.minute.ago)
    end
  end

  describe "GET /api/v1/agent_context_events" do
    context "with valid authentication" do
      it "returns events for the specified project" do
        get "/api/v1/agent_context_events", params: { project_id: project.id }, headers: auth_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json.length).to eq(2)
        expect(json.map { |e| e["event_type"] }).to contain_exactly("images.created", "images.deleted")
      end

      it "filters events by event_types" do
        get "/api/v1/agent_context_events",
          params: { project_id: project.id, event_types: ["images.deleted"] },
          headers: auth_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json.length).to eq(1)
        expect(json.first["event_type"]).to eq("images.deleted")
      end

      it "filters events by since timestamp" do
        get "/api/v1/agent_context_events",
          params: { project_id: project.id, since: 1.hour.ago.iso8601 },
          headers: auth_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json.length).to eq(1)
        expect(json.first["event_type"]).to eq("images.deleted")
      end

      it "returns events in chronological order" do
        get "/api/v1/agent_context_events", params: { project_id: project.id }, headers: auth_headers

        json = JSON.parse(response.body)
        timestamps = json.map { |e| Time.parse(e["created_at"]) }
        expect(timestamps).to eq(timestamps.sort)
      end

      it "includes event payload" do
        ActsAsTenant.with_tenant(account) do
          create(:agent_context_event,
            account: account,
            project: project,
            event_type: "images.created",
            payload: { upload_id: 123, filename: "test.jpg" })
        end

        get "/api/v1/agent_context_events", params: { project_id: project.id }, headers: auth_headers

        json = JSON.parse(response.body)
        event_with_payload = json.find { |e| e["payload"]["upload_id"] == 123 }
        expect(event_with_payload["payload"]["filename"]).to eq("test.jpg")
      end
    end

    context "with missing project_id" do
      it "returns bad request" do
        get "/api/v1/agent_context_events", headers: auth_headers

        expect(response).to have_http_status(:bad_request)
        json = JSON.parse(response.body)
        expect(json["errors"]).to include("project_id is required")
      end
    end

    context "with non-existent project" do
      it "returns not found" do
        get "/api/v1/agent_context_events", params: { project_id: 999999 }, headers: auth_headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context "without authentication" do
      it "returns unauthorized" do
        get "/api/v1/agent_context_events", params: { project_id: project.id }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with another account's project" do
      let(:other_user) { create(:user) }
      let(:other_account) { other_user.owned_account }
      let(:other_project) { create(:project, account: other_account) }

      it "returns not found" do
        get "/api/v1/agent_context_events", params: { project_id: other_project.id }, headers: auth_headers

        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
