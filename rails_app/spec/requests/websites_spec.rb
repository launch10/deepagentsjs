require 'rails_helper'
require 'support/website_file_helpers'

RSpec.describe "Websites", type: :request do
  let(:user) { create(:user) }
  let(:account) { user.owned_account || create(:account, owner: user) }
  let(:project) { create(:project, account: account) }
  let(:headers) { auth_headers_for(user) }
  
  describe "POST /websites" do
    let(:valid_params) do
      {
        website: {
          name: "My Landing Page",
          thread_id: SecureRandom.uuid,
          project_id: project.id,
          files_attributes: minimal_website_files
        }
      }
    end

    context "without authentication" do
      it "returns unauthorized" do
        expect { 
          post "/websites", params: valid_params, as: :json
      }.to_not change(Website, :count)
        expect(response).to have_http_status(:unauthorized)
        expect(JSON.parse(response.body)["error"]).to eq("Missing token")
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
        end

        it "requires subscription" do
          expect {
            post "/websites", params: valid_params, headers: headers, as: :json
          }.to_not change(Website, :count)
          expect(response).to have_http_status(:unauthorized)
          expect(JSON.parse(response.body)["error"]).to eq("Subscription required")
        end
      end

      context "when user is subscribed" do
        before do
          ensure_plans_exist
          subscribe_account(account, plan_name: 'pro')
        end

        it "creates a website with thread_id" do
          # Verify subscription is set up
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
          expect(website.user_id).to eq(user.id)
          expect(website.project_id).to eq(project.id)
        end

        it "creates website files" do
          expect {
            post "/websites", params: valid_params, headers: headers, as: :json
          }.to change(WebsiteFile, :count).by(2)

          website = Website.last
          files = website.files
          
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
          it "returns errors when thread_id is missing" do
            invalid_params = valid_params.deep_dup
            invalid_params[:website].delete(:thread_id)
            
            post "/websites", params: invalid_params, headers: headers, as: :json
            
            expect(response).to have_http_status(:unprocessable_entity)
            json = JSON.parse(response.body)
            expect(json["errors"]).to include("Thread can't be blank")
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
                files_attributes: website_files_attributes
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
            
            # Verify some specific files were created
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