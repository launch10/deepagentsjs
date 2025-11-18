require 'swagger_helper'

RSpec.describe "Brainstorms API", type: :request do
  let!(:template) { create(:template) }

  describe "Multitenancy with Account Switching" do
    let(:user1) { create(:user, name: "User 1") }
    let(:user2) { create(:user, name: "User 2") }
    
    let!(:user1_owned_account) { user1.owned_account }
    let!(:user1_team_account) { create_account_with_user(user1, account_name: "User 1 Team Account") }
    let!(:user2_owned_account) { user2.owned_account }

    let!(:project1_owned) { create(:project, account: user1_owned_account, name: "Project in Owned Account") }
    let!(:project1_team) { create(:project, account: user1_team_account, name: "Project in Team Account") }
    let!(:project2_owned) { create(:project, account: user2_owned_account, name: "User 2 Project") }

    before do
      ensure_plans_exist
      subscribe_account(user1_owned_account, plan_name: 'pro')
      subscribe_account(user1_team_account, plan_name: 'pro')
      subscribe_account(user2_owned_account, plan_name: 'pro')
    end

    def valid_brainstorm_params(name:)
      {
        brainstorm: {
          name: name,
          thread_id: SecureRandom.uuid
        }
      }
    end

    describe "POST /brainstorms - creating brainstorms" do
      context "when user defaults to owned account" do
        it "creates brainstorm in user's logged in account" do
          expect {
            post "/api/v1/brainstorms", 
              params: valid_brainstorm_params(name: "Brainstorm in Owned Account"),
              headers: auth_headers_for(user1),
              as: :json
          }.to change(Brainstorm, :count).by(1)

          expect(response).to have_http_status(:created)
          brainstorm = Brainstorm.last
          expect(brainstorm.project.account_id).to eq(user1_owned_account.id)
          expect(brainstorm.name).to eq("Brainstorm in Owned Account")
          expect(brainstorm.website.account_id).to eq(user1_owned_account.id)
          expect(brainstorm.chat.account_id).to eq(user1_owned_account.id)
        end
      end

      context "when user switches to team account" do
        it "creates brainstorm in different account after switching" do
          switch_account_to(user1_team_account)

          expect {
            post "/api/v1/brainstorms",
              params: valid_brainstorm_params(name: "Brainstorm in Team Account"),
              headers: auth_headers_for(user1),
              as: :json
          }.to change(Brainstorm, :count).by(1)

          expect(response).to have_http_status(:created)
          brainstorm = Brainstorm.last
          expect(brainstorm.project.account_id).to eq(user1_team_account.id)
          expect(brainstorm.name).to eq("Brainstorm in Team Account")
          expect(brainstorm.website.account_id).to eq(user1_team_account.id)
          expect(brainstorm.chat.account_id).to eq(user1_team_account.id)
        end
      end
    end

    describe "GET /api/v1/brainstorms/{thread_id} - reading brainstorms" do
      let(:thread1) { "123" }
      let(:thread2) { "456" }
      let(:thread3) { "789" }

      let!(:website1_owned) { create(:website, account: user1_owned_account, project: project1_owned, name: "Owned Website", template: template) }
      let!(:website1_team) { create(:website, account: user1_team_account, project: project1_team, name: "Team Website", template: template) }
      let!(:website2_owned) { create(:website, account: user2_owned_account, project: project2_owned, name: "User 2 Website", template: template) }
      
      let!(:brainstorm1_owned) { create(:brainstorm, website: website1_owned, thread_id: thread1, project: project1_owned) }
      let!(:brainstorm1_team) { create(:brainstorm, website: website1_team, thread_id: thread2, project: project1_team) }
      let!(:brainstorm2_owned) { create(:brainstorm, website: website2_owned, thread_id: thread3, project: project2_owned) }

      let!(:chat1_owned) { create(:chat, thread_id: thread1, project: project1_owned, account: user1_owned_account, contextable: brainstorm1_owned) }
      let!(:chat1_team) { create(:chat, thread_id: thread2, project: project1_team, account: user1_team_account, contextable: brainstorm1_team) }
      let!(:chat2_owned) { create(:chat, thread_id: thread3, project: project2_owned, account: user2_owned_account, contextable: brainstorm2_owned) }

      context "when viewing owned account" do
        it "only sees brainstorm in logged in account"  do
          get "/api/v1/brainstorms/#{thread1}", headers: auth_headers_for(user1)

          expect(response).to have_http_status(:ok)
          json = JSON.parse(response.body)
          
          expect(json["id"]).to eq(brainstorm1_owned.id)
          expect(json["thread_id"]).to eq(brainstorm1_owned.thread_id)
        end

        it "cannot access team account brainstorm when not logged into that account" do
          get "/api/v1/brainstorms/#{brainstorm1_team.thread_id}", headers: auth_headers_for(user1)

          expect(response).to have_http_status(:not_found)
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Not found")
        end
      end

      context "when switching to team account" do
        it "only sees brainstorm in team account after switching" do
          switch_account_to(user1_team_account)
          
          get "/api/v1/brainstorms/#{brainstorm1_team.thread_id}", headers: auth_headers_for(user1)

          expect(response).to have_http_status(:ok)
          json = JSON.parse(response.body)
          
          expect(json["id"]).to eq(brainstorm1_team.id)
          expect(json["thread_id"]).to eq(brainstorm1_team.thread_id)
        end

        it "cannot access owned account brainstorm when not logged into that account" do
          switch_account_to(user1_team_account)
          
          get "/api/v1/brainstorms/#{brainstorm1_owned.thread_id}", headers: auth_headers_for(user1)

          expect(response).to have_http_status(:not_found)
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Not found")
        end
      end

      context "when switching back to owned account" do
        it "sees owned account brainstorm again" do
          switch_account_to(user1_team_account)
          get "/api/v1/brainstorms/#{brainstorm1_team.thread_id}", headers: auth_headers_for(user1)
          json1 = JSON.parse(response.body)
          expect(json1["id"]).to eq(brainstorm1_team.id)

          switch_account_to(user1_owned_account)
          get "/api/v1/brainstorms/#{brainstorm1_owned.thread_id}", headers: auth_headers_for(user1)
          json2 = JSON.parse(response.body)
          expect(json2["id"]).to eq(brainstorm1_owned.id)
        end
      end

      context "when user2 views their account" do
        it "only sees their own brainstorm" do
          get "/api/v1/brainstorms/#{brainstorm2_owned.thread_id}", headers: auth_headers_for(user2)

          expect(response).to have_http_status(:ok)
          json = JSON.parse(response.body)
          
          expect(json["id"]).to eq(brainstorm2_owned.id)
          expect(json["thread_id"]).to eq(brainstorm2_owned.thread_id)
        end

        it "cannot access user1's brainstorm" do
          get "/api/v1/brainstorms/#{brainstorm1_owned.thread_id}", headers: auth_headers_for(user2)

          expect(response).to have_http_status(:not_found)
          json = JSON.parse(response.body)
          expect(json["errors"]).to include("Not found")
        end
      end
    end

    describe "PATCH /brainstorms/{thread_id} - updating brainstorms" do
      let!(:website1_owned) { create(:website, account: user1_owned_account, project: project1_owned, template: template) }
      let!(:website1_team) { create(:website, account: user1_team_account, project: project1_team, template: template) }
      
      let!(:brainstorm1_owned) { create(:brainstorm, website: website1_owned) }
      let!(:brainstorm1_team) { create(:brainstorm, website: website1_team) }

      let!(:chat1_owned) { create(:chat, thread_id: brainstorm1_owned.thread_id, project: project1_owned, account: user1_owned_account, contextable: brainstorm1_owned) }
      let!(:chat1_team) { create(:chat, thread_id: brainstorm1_team.thread_id, project: project1_team, account: user1_team_account, contextable: brainstorm1_team) }

      context "when updating in owned account" do
        it "updates brainstorm in owned account" do
          patch "/api/v1/brainstorms/#{brainstorm1_owned.thread_id}",
            params: { brainstorm: { idea: "Updated idea" } },
            headers: auth_headers_for(user1),
            as: :json

          expect(response).to have_http_status(:ok)
          brainstorm1_owned.reload
          expect(brainstorm1_owned.idea).to eq("Updated idea")
        end

        it "cannot update team account brainstorm from owned account" do
          patch "/api/v1/brainstorms/#{brainstorm1_team.thread_id}",
            params: { brainstorm: { idea: "Should not update" } },
            headers: auth_headers_for(user1),
            as: :json

          expect(response).to have_http_status(:not_found)
          brainstorm1_team.reload
          expect(brainstorm1_team.idea).to be_nil
        end
      end

      context "when updating in team account" do
        it "updates brainstorm in team account after switching" do
          switch_account_to(user1_team_account)

          patch "/api/v1/brainstorms/#{brainstorm1_team.thread_id}",
            params: { brainstorm: { idea: "Team idea" } },
            headers: auth_headers_for(user1),
            as: :json

          expect(response).to have_http_status(:ok)
          brainstorm1_team.reload
          expect(brainstorm1_team.idea).to eq("Team idea")
        end

        it "cannot update owned account brainstorm from team account" do
          switch_account_to(user1_team_account)

          patch "/api/v1/brainstorms/#{brainstorm1_owned.thread_id}",
            params: { brainstorm: { idea: "Should not update" } },
            headers: auth_headers_for(user1),
            as: :json

          expect(response).to have_http_status(:not_found)
          brainstorm1_owned.reload
          expect(brainstorm1_owned.idea).to be_nil
        end
      end
    end

    describe "Full workflow: create in both accounts" do
      it "allows user to create and view brainstorms across their accounts" do
        params_owned = valid_brainstorm_params(name: "First Owned Brainstorm")
        post "/api/v1/brainstorms", params: params_owned, headers: auth_headers_for(user1), as: :json
        expect(response).to have_http_status(:created)
        owned_brainstorm_thread_id = JSON.parse(response.body)["thread_id"]

        switch_account_to(user1_team_account)
        
        params_team = valid_brainstorm_params(name: "First Team Brainstorm")
        post "/api/v1/brainstorms", params: params_team, headers: auth_headers_for(user1), as: :json
        expect(response).to have_http_status(:created)
        team_brainstorm_thread_id = JSON.parse(response.body)["thread_id"]

        get "/api/v1/brainstorms/#{team_brainstorm_thread_id}", headers: auth_headers_for(user1)
        expect(response).to have_http_status(:ok)
        team_brainstorm = JSON.parse(response.body)
        expect(team_brainstorm["thread_id"]).to eq(team_brainstorm_thread_id)
        expect(team_brainstorm["name"]).to eq("First Team Brainstorm")

        switch_account_to(user1_owned_account)
        
        get "/api/v1/brainstorms/#{owned_brainstorm_thread_id}", headers: auth_headers_for(user1)
        expect(response).to have_http_status(:ok)
        owned_brainstorm = JSON.parse(response.body)
        expect(owned_brainstorm["thread_id"]).to eq(owned_brainstorm_thread_id)
        expect(owned_brainstorm["name"]).to eq("First Owned Brainstorm")
      end
    end
  end
end