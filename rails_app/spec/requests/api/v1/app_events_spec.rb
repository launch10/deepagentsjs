# frozen_string_literal: true

require "swagger_helper"

RSpec.describe "App Events API", type: :request do
  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }
  let(:service_headers) { internal_service_headers }

  path "/api/v1/app_events" do
    post "Creates an internal app event" do
      tags "App Events"
      consumes "application/json"
      produces "application/json"
      parameter name: "X-Signature", in: :header, type: :string, required: false
      parameter name: "X-Timestamp", in: :header, type: :string, required: false
      parameter name: :body, in: :body, schema: APISchemas::AppEvent.create_request

      response "202", "event accepted" do
        let(:"X-Signature") { service_headers["X-Signature"] }
        let(:"X-Timestamp") { service_headers["X-Timestamp"] }
        let(:body) do
          {
            event_name: "chat_message_sent",
            user_id: user.id,
            project_id: project.id,
            properties: {chat_type: "website", thread_id: "thread_123"}
          }
        end

        run_test! do |response|
          expect(response).to have_http_status(:accepted)
          event = AppEvent.last
          expect(event.event_name).to eq("chat_message_sent")
          expect(event.user_id).to eq(user.id)
          expect(event.project_id).to eq(project.id)
          expect(event.properties).to include("chat_type" => "website")
        end
      end

      response "202", "event accepted without optional fields" do
        let(:"X-Signature") { service_headers["X-Signature"] }
        let(:"X-Timestamp") { service_headers["X-Timestamp"] }
        let(:body) do
          {event_name: "chat_message_sent"}
        end

        run_test! do |response|
          expect(response).to have_http_status(:accepted)
          event = AppEvent.last
          expect(event.event_name).to eq("chat_message_sent")
          expect(event.user_id).to be_nil
          expect(event.project_id).to be_nil
        end
      end

      response "422", "rejects missing event_name" do
        let(:"X-Signature") { service_headers["X-Signature"] }
        let(:"X-Timestamp") { service_headers["X-Timestamp"] }
        let(:body) do
          {user_id: user.id}
        end

        run_test! do |response|
          json = JSON.parse(response.body)
          expect(json["error"]).to be_present
        end
      end

      response "401", "unauthorized - missing signature" do
        let(:"X-Signature") { nil }
        let(:"X-Timestamp") { nil }
        let(:body) do
          {event_name: "chat_message_sent"}
        end

        run_test!
      end
    end
  end

  describe "POST /api/v1/app_events with Authorization header" do
    it "rejects requests that include an Authorization header" do
      headers = auth_headers_for(user)

      post "/api/v1/app_events",
        params: {event_name: "chat_message_sent"}.to_json,
        headers: headers.merge("Content-Type" => "application/json")

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
