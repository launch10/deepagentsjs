require 'rails_helper'
require 'support/website_file_helpers'

RSpec.describe "Websites", type: :request do
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

    def valid_website_params(name:, project:)
      {
        website: {
          name: name,
          thread_id: SecureRandom.uuid,
          project_id: project.id,
          website_files_attributes: minimal_website_files
        }
      }
    end

    describe "POST /websites - creating websites" do
      context "when user defaults to owned account" do
        it "creates website in user's owned account by default" do
          expect {
            post "/websites", 
              params: valid_website_params(name: "Website in Owned Account", project: project1_owned),
              headers: auth_headers_for(user1),
              as: :json
          }.to change(Website, :count).by(1)

          expect(response).to have_http_status(:created)
          website = Website.last
          expect(website.account_id).to eq(user1_owned_account.id)
          expect(website.project_id).to eq(project1_owned.id)
          expect(website.name).to eq("Website in Owned Account")
        end
      end

      context "when user switches to team account" do
        it "creates website in team account after switching" do
          switch_account_to(user1_team_account)

          expect {
            post "/websites",
              params: valid_website_params(name: "Website in Team Account", project: project1_team),
              headers: auth_headers_for(user1),
              as: :json
          }.to change(Website, :count).by(1)

          expect(response).to have_http_status(:created)
          website = Website.last
          expect(website.account_id).to eq(user1_team_account.id)
          expect(website.project_id).to eq(project1_team.id)
          expect(website.name).to eq("Website in Team Account")
        end
      end
    end

    describe "GET /websites - reading websites" do
      let!(:website1_owned) { create(:website, account: user1_owned_account, project: project1_owned, name: "Owned Website", template: template) }
      let!(:website1_team) { create(:website, account: user1_team_account, project: project1_team, name: "Team Website", template: template) }
      let!(:website2_owned) { create(:website, account: user2_owned_account, project: project2_owned, name: "User 2 Website", template: template) }

      context "when viewing owned account" do
        it "only sees websites in owned account" do
          get "/websites", headers: auth_headers_for(user1)

          expect(response).to have_http_status(:ok)
          json = JSON.parse(response.body)
          
          expect(json.length).to eq(1)
          expect(json.first["id"]).to eq(website1_owned.id)
          expect(json.first["name"]).to eq("Owned Website")
        end
      end

      context "when switching to team account" do
        it "only sees websites in team account after switching" do
          switch_account_to(user1_team_account)
          
          get "/websites", headers: auth_headers_for(user1)

          expect(response).to have_http_status(:ok)
          json = JSON.parse(response.body)
          
          expect(json.length).to eq(1)
          expect(json.first["id"]).to eq(website1_team.id)
          expect(json.first["name"]).to eq("Team Website")
        end
      end

      context "when switching back to owned account" do
        it "sees owned account websites again" do
          switch_account_to(user1_team_account)
          get "/websites", headers: auth_headers_for(user1)
          json1 = JSON.parse(response.body)
          expect(json1.first["name"]).to eq("Team Website")

          switch_account_to(user1_owned_account)
          get "/websites", headers: auth_headers_for(user1)
          json2 = JSON.parse(response.body)
          expect(json2.first["name"]).to eq("Owned Website")
        end
      end

      context "when user2 views their account" do
        it "only sees their own websites" do
          get "/websites", headers: auth_headers_for(user2)

          expect(response).to have_http_status(:ok)
          json = JSON.parse(response.body)
          
          expect(json.length).to eq(1)
          expect(json.first["id"]).to eq(website2_owned.id)
          expect(json.first["name"]).to eq("User 2 Website")
        end
      end
    end

    describe "Full workflow: create in both accounts" do
      it "allows user to create and view websites across their accounts" do
        params_owned = valid_website_params(name: "First Owned", project: project1_owned)
        post "/websites", params: params_owned, headers: auth_headers_for(user1), as: :json
        expect(response).to have_http_status(:created)
        owned_website_id = JSON.parse(response.body)["id"]

        switch_account_to(user1_team_account)
        
        params_team = valid_website_params(name: "First Team", project: project1_team)
        post "/websites", params: params_team, headers: auth_headers_for(user1), as: :json
        expect(response).to have_http_status(:created)
        team_website_id = JSON.parse(response.body)["id"]

        get "/websites", headers: auth_headers_for(user1)
        team_websites = JSON.parse(response.body)
        expect(team_websites.length).to eq(1)
        expect(team_websites.first["id"]).to eq(team_website_id)
        expect(team_websites.first["name"]).to eq("First Team")

        switch_account_to(user1_owned_account)
        
        get "/websites", headers: auth_headers_for(user1)
        owned_websites = JSON.parse(response.body)
        expect(owned_websites.length).to eq(1)
        expect(owned_websites.first["id"]).to eq(owned_website_id)
        expect(owned_websites.first["name"]).to eq("First Owned")
      end
    end
  end

  describe "Legacy tests - single account context" do
    let(:user) { create(:user) }
    let(:account) { user.owned_account }
    let(:project) { create(:project, account: account) }
    let(:headers) { auth_headers_for(user) }

    before do
      ensure_plans_exist
      subscribe_account(account, plan_name: 'pro')
    end

    let(:valid_params) do
      {
        website: {
          name: "My Landing Page",
          thread_id: SecureRandom.uuid,
          project_id: project.id,
          website_files_attributes: minimal_website_files
        }
      }
    end

    describe "POST /websites" do
      context "without authentication" do
        it "returns unauthorized" do
          expect {
            post "/websites", params: valid_params, as: :json
          }.to_not change(Website, :count)
          expect(response).to have_http_status(:unauthorized)
          expect(JSON.parse(response.body)["error"]).to eq("Unauthorized")
        end
      end

      context "with invalid JWT" do
        it "returns unauthorized" do
          expect {
            post "/websites", params: valid_params, headers: invalid_auth_headers, as: :json
          }.to_not change(Website, :count)
          expect(response).to have_http_status(:unauthorized)
        end
      end

      context "with valid JWT" do
        context "when user is not subscribed" do
          before do
            ensure_plans_exist
            unsubscribe_account(account)
          end

          it "requires subscription" do
            expect {
              post "/websites", params: valid_params, headers: headers, as: :json
            }.to_not change(Website, :count)
            expect(response).to have_http_status(:unauthorized)
            expect(JSON.parse(response.body)["error"]).to eq("Unauthorized")
          end
        end

        context "when user is subscribed" do
          it "creates a website with thread_id" do
            expect(account.payment_processor).to be_present
            expect(account.payment_processor.subscribed?).to be true

            expect {
              post "/websites", params: valid_params, headers: headers, as: :json
            }.to change(Website, :count).by(1)

            expect(response).to have_http_status(:created)

            json = JSON.parse(response.body)
            expect(json["thread_id"]).to eq(valid_params[:website][:thread_id])
            expect(json["name"]).to eq("My Landing Page")

            website = Website.last
            expect(website.thread_id).to eq(valid_params[:website][:thread_id])
            expect(website.account_id).to eq(account.id)
            expect(website.project_id).to eq(project.id)
          end

          it "creates website files" do
            expect {
              post "/websites", params: valid_params, headers: headers, as: :json
            }.to change(WebsiteFile, :count).by(2)

            website = Website.last
            files = website.website_files

            expect(files.map(&:path)).to contain_exactly("index.html", "styles.css")
            expect(files.find_by(path: "index.html").content).to include("Hello World")
            expect(files.find_by(path: "styles.css").content).to include("background: #fff")
          end

          it "returns website json with files" do
            post "/websites", params: valid_params, headers: headers, as: :json

            json = JSON.parse(response.body)
            expect(json["id"]).to be_present
            expect(json["thread_id"]).to be_present
            expect(json["files"]).to be_an(Array)
            expect(json["files"].length).to eq(2)
          end

          context "with invalid params" do
            it "creates website even when thread_id is missing" do
              invalid_params = valid_params.deep_dup
              invalid_params[:website].delete(:thread_id)

              post "/websites", params: invalid_params, headers: headers, as: :json

              expect(response).to have_http_status(:created)
              json = JSON.parse(response.body)
              expect(json["id"]).to be_present
            end

            it "returns errors when name is missing" do
              invalid_params = valid_params.deep_dup
              invalid_params[:website].delete(:name)

              post "/websites", params: invalid_params, headers: headers, as: :json

              expect(response).to have_http_status(:unprocessable_entity)
              json = JSON.parse(response.body)
              expect(json["errors"]).to include("Name can't be blank")
            end
          end

          context "with full fixture files" do
            let(:params_with_full_files) do
              {
                website: {
                  name: "Complete Landing Page",
                  thread_id: "thread_#{SecureRandom.hex(8)}",
                  project_id: project.id,
                  website_files_attributes: website_files_attributes
                }
              }
            end

            it "creates website with all fixture files" do
              expect {
                post "/websites", params: params_with_full_files, headers: headers, as: :json
              }.to change(Website, :count).by(1)
                .and change(WebsiteFile, :count).by(valid_website_files.count)

              expect(response).to have_http_status(:created)

              website = Website.last
              expect(website.files.count).to eq(valid_website_files.count)

              expect(website.files.pluck(:path)).to include(
                "src/components/Hero.tsx",
                "src/components/Footer.tsx",
                "src/index.css"
              )
            end
          end
        end
      end
    end
  end
end
