# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Test::DeploysController", type: :request do
  include Devise::Test::IntegrationHelpers

  let!(:user) { create(:user, name: "Test User") }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }
  let!(:deploy) { create(:deploy, project: project, status: "running", current_step: "ConnectingGoogle") }

  before do
    sign_in user
  end

  describe "DELETE /test/deploys/:deploy_id/restart" do
    it "soft-deletes the deploy so Langgraph creates a fresh one on reload" do
      stub_request(:delete, "#{Langgraph.url}/api/deploy/thread/#{deploy.thread_id}")
        .to_return(status: 200, body: "{}", headers: {"Content-Type" => "application/json"})

      delete "/test/deploys/#{deploy.id}/restart"

      expect(response).to have_http_status(:ok)
      data = JSON.parse(response.body)
      expect(data["success"]).to be true

      # Deploy is soft-deleted (acts_as_paranoid)
      expect(Deploy.find_by(id: deploy.id)).to be_nil
      expect(Deploy.with_deleted.find(deploy.id).deleted_at).to be_present
    end

    it "succeeds even when langgraph checkpoint deletion fails" do
      stub_request(:delete, "#{Langgraph.url}/api/deploy/thread/#{deploy.thread_id}")
        .to_raise(ApplicationClient::InternalError.new("500"))

      delete "/test/deploys/#{deploy.id}/restart"

      expect(response).to have_http_status(:ok)

      expect(Deploy.find_by(id: deploy.id)).to be_nil
    end
  end
end
