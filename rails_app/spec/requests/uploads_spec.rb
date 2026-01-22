require 'swagger_helper'

RSpec.describe "Uploads API", type: :request do
  let!(:template) { create(:template) }

  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_owned_account) { user1.owned_account }
  let!(:user1_team_account) { create_account_with_user(user1, account_name: "User 1 Team Account") }
  let!(:user2_owned_account) { user2.owned_account }

  let!(:project1_owned) { create(:project, account: user1_owned_account, name: "Project in Owned Account") }
  let!(:project1_team) { create(:project, account: user1_team_account, name: "Project in Team Account") }
  let!(:website1_owned) { create(:website, account: user1_owned_account, project: project1_owned, template: template) }
  let!(:website1_team) { create(:website, account: user1_team_account, project: project1_team, template: template) }

  before do
    ensure_plans_exist
    subscribe_account(user1_owned_account, plan_name: "growth_monthly")
    subscribe_account(user1_team_account, plan_name: "growth_monthly")
    subscribe_account(user2_owned_account, plan_name: "growth_monthly")
  end

  def valid_upload_params(is_logo: false, website_id: nil)
    params = {
      upload: {
        file: fixture_file_upload(Rails.root.join('spec/fixtures/files/test_image.jpg'), 'image/jpeg'),
        is_logo: is_logo
      }
    }
    params[:upload][:website_id] = website_id if website_id
    params
  end

  path '/api/v1/uploads' do
    post 'Creates an upload' do
      tags 'Uploads'
      consumes 'multipart/form-data'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: 'upload[file]', in: :formData, type: :file, required: true
      parameter name: 'upload[is_logo]', in: :formData, type: :boolean, required: false
      parameter name: 'upload[website_id]', in: :formData, type: :integer, required: false,
        description: 'Associate upload with a website (also sets project_id from website)'

      before do
        switch_account_to(user1_owned_account)
      end

      response '201', 'upload created in owned account' do
        schema APISchemas::Upload.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:"upload[file]") { fixture_file_upload(Rails.root.join('spec/fixtures/files/test_image.jpg'), 'image/jpeg') }
        let(:"upload[is_logo]") { true }

        run_test! do |response|
          data = JSON.parse(response.body)
          upload = Upload.find(data["id"])

          expect(upload.account_id).to eq(user1_owned_account.id)
          expect(upload.media_type).to eq("image")
          expect(upload.is_logo).to eq(true)
          expect(upload.original_filename).to eq("test_image.jpg")
          expect(data["filename"]).to eq("test_image.jpg")
          expect(data["thumb_url"]).to be_present
          expect(data["medium_url"]).to be_present
        end
      end

      response '201', 'upload created and associated with website' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:"upload[file]") { fixture_file_upload(Rails.root.join('spec/fixtures/files/test_image.jpg'), 'image/jpeg') }
        let(:"upload[is_logo]") { false }
        let(:"upload[website_id]") { website1_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          upload = Upload.find(data["id"])

          expect(upload.account_id).to eq(user1_owned_account.id)
          expect(upload.websites).to include(website1_owned)
          expect(upload.is_logo).to eq(false)
          # project is derived through website association
          expect(upload.projects).to include(project1_owned)
        end
      end

      response '201', "uploads to team account" do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:"upload[file]") { fixture_file_upload(Rails.root.join('spec/fixtures/files/test_image.jpg'), 'image/jpeg') }
        let(:"upload[is_logo]") { false }
        let(:"upload[website_id]") { website1_team.id }

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          upload = Upload.find(data["id"])

          expect(upload.account_id).to eq(user1_team_account.id)
          expect(upload.websites).to include(website1_team)
        end
      end

      response '422', "errors if uploading to website you don't own" do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:"upload[file]") { fixture_file_upload(Rails.root.join('spec/fixtures/files/test_image.jpg'), 'image/jpeg') }
        let(:"upload[is_logo]") { false }
        let(:"upload[website_id]") { website1_team.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("invalid upload")
        end
      end

      response '422', "website not exist" do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:"upload[file]") { fixture_file_upload(Rails.root.join('spec/fixtures/files/test_image.jpg'), 'image/jpeg') }
        let(:"upload[website_id]") { 999999 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("invalid upload")
        end
      end

      response "201", "video upload created" do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:"upload[file]") { fixture_file_upload(Rails.root.join('spec/fixtures/files/test_video.mp4'), 'video/mp4') }
        let(:"upload[is_logo]") { false }
        let(:"upload[website_id]") { website1_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          upload = Upload.find(data["id"])

          expect(upload.media_type).to eq("video")
          expect(upload.original_filename).to eq("test_video.mp4")
          expect(data["filename"]).to eq("test_video.mp4")
        end
      end

      response "201", "creating upload without website" do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:"upload[file]") { fixture_file_upload(Rails.root.join('spec/fixtures/files/test_video.mp4'), 'video/mp4') }
        let(:"upload[is_logo]") { false }

        run_test! do |response|
          data = JSON.parse(response.body)
          upload = Upload.find(data["id"])

          expect(upload.media_type).to eq("video")
        end
      end

      response "201", "PDF upload created as document" do
        schema APISchemas::Upload.response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:"upload[file]") { fixture_file_upload(Rails.root.join('spec/fixtures/files/test_document.pdf'), 'application/pdf') }
        let(:"upload[is_logo]") { false }

        run_test! do |response|
          data = JSON.parse(response.body)
          upload = Upload.find(data["id"])

          expect(upload.media_type).to eq("document")
          expect(upload.original_filename).to eq("test_document.pdf")
          expect(data["filename"]).to eq("test_document.pdf")
          expect(data["media_type"]).to eq("document")
          # PDFs don't have thumbnail/medium versions
          expect(data["thumb_url"]).to be_nil
          expect(data["medium_url"]).to be_nil
        end
      end

      response "201", "PDF upload associated with website" do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:"upload[file]") { fixture_file_upload(Rails.root.join('spec/fixtures/files/test_document.pdf'), 'application/pdf') }
        let(:"upload[is_logo]") { false }
        let(:"upload[website_id]") { website1_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          upload = Upload.find(data["id"])

          expect(upload.media_type).to eq("document")
          expect(upload.websites).to include(website1_owned)
        end
      end

      response "401", "unauthorized - missing token" do
        let(:Authorization) { nil }
        let(:"upload[file]") { fixture_file_upload(Rails.root.join('spec/fixtures/files/test_image.jpg'), 'image/jpeg') }

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end
    end

    get 'Retrieves uploads' do
      tags 'Uploads'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :website_id, in: :query, type: :integer, required: false, description: 'Filter by website'
      parameter name: :is_logo, in: :query, type: :boolean, required: false,
        description: 'Filter by logo status (true for logos, false for product images)'
      parameter name: :order, in: :query, type: :string, required: false,
        description: 'Sort order (recent for created_at desc)'
      parameter name: :limit, in: :query, type: :integer, required: false,
        description: 'Limit number of results'

      let!(:upload1_owned) { create(:upload, account: user1_owned_account, is_logo: false) }
      let!(:upload2_owned) { create(:upload, account: user1_owned_account, is_logo: true) }
      let!(:upload1_team) { create(:upload, account: user1_team_account, is_logo: false) }

      before do
        website1_owned.uploads << upload1_owned
      end

      response "200", "returns all account uploads" do
        schema APISchemas::Upload.collection_response
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(2)
          expect(data.map { |u| u["id"] }).to contain_exactly(upload1_owned.id, upload2_owned.id)
        end
      end

      response "200", "returns uploads filtered by website" do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:website_id) { website1_owned.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(1)
          expect(data.first["id"]).to eq(upload1_owned.id)
        end
      end

      response "200", "returns only logos when is_logo=true" do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:is_logo) { true }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(1)
          expect(data.first["id"]).to eq(upload2_owned.id)
          expect(data.first["is_logo"]).to eq(true)
        end
      end

      response "200", "returns only non-logos when is_logo=false" do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:is_logo) { false }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(1)
          expect(data.first["id"]).to eq(upload1_owned.id)
          expect(data.first["is_logo"]).to eq(false)
        end
      end

      response "200", "returns team account uploads after switching" do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(1)
          expect(data.first["id"]).to eq(upload1_team.id)
        end
      end

      response "404", "website not found when filtering" do
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

      response "200", "returns uploads sorted by created_at desc when order=recent" do
        # Create uploads and then update their timestamps to avoid factory validation issues
        let!(:old_upload) do
          upload = create(:upload, account: user1_owned_account, is_logo: false)
          upload.update_column(:created_at, 10.days.ago)
          upload
        end
        let!(:new_upload) do
          upload = create(:upload, account: user1_owned_account, is_logo: false)
          upload.update_column(:created_at, 1.second.from_now)
          upload
        end
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:order) { 'recent' }

        run_test! do |response|
          data = JSON.parse(response.body)
          # Should be ordered by created_at desc (newest first)
          ids = data.map { |u| u["id"] }
          # new_upload should be first since it has the newest created_at
          expect(ids.first).to eq(new_upload.id)
          # old_upload should be last since it has the oldest created_at
          expect(ids.last).to eq(old_upload.id)
        end
      end

      response "200", "returns limited number of uploads when limit is specified" do
        # Create 5 more uploads for this test
        let!(:extra_uploads) do
          5.times.map { |i| create(:upload, account: user1_owned_account, is_logo: false, created_at: i.hours.ago) }
        end
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:limit) { 3 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(3)
        end
      end

      response "200", "returns uploads with order=recent and limit combined" do
        # Create uploads and then update their timestamps to avoid factory validation issues
        let!(:upload_old) do
          upload = create(:upload, account: user1_owned_account, is_logo: false)
          upload.update_column(:created_at, 10.days.ago)
          upload
        end
        let!(:upload_mid) do
          upload = create(:upload, account: user1_owned_account, is_logo: false)
          upload.update_column(:created_at, 1.second.from_now)
          upload
        end
        let!(:upload_new) do
          upload = create(:upload, account: user1_owned_account, is_logo: false)
          upload.update_column(:created_at, 2.seconds.from_now)
          upload
        end
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:order) { 'recent' }
        let(:limit) { 2 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(2)
          # Should be the 2 most recent (newest first)
          ids = data.map { |u| u["id"] }
          expect(ids).to include(upload_new.id)
          expect(ids).to include(upload_mid.id)
          expect(ids).not_to include(upload_old.id)
        end
      end
    end
  end

  path '/api/v1/uploads/{id}' do
    delete 'Deletes an upload' do
      tags 'Uploads'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false
      parameter name: :id, in: :path, type: :integer, required: true, description: 'Upload ID'

      let!(:upload) { create(:upload, account: user1_owned_account, is_logo: false) }

      before do
        switch_account_to(user1_owned_account)
      end

      response '204', 'upload deleted successfully' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { upload.id }

        run_test! do |_response|
          expect(Upload.find_by(id: upload.id)).to be_nil
        end
      end

      response '404', 'upload not found' do
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { 999999 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Upload not found")
        end
      end

      response '404', 'cannot delete upload owned by another account' do
        let!(:other_upload) { create(:upload, account: user2_owned_account, is_logo: false) }
        let(:auth_headers) { auth_headers_for(user1) }
        let(:Authorization) { auth_headers['Authorization'] }
        let(:"X-Signature") { auth_headers['X-Signature'] }
        let(:"X-Timestamp") { auth_headers['X-Timestamp'] }
        let(:id) { other_upload.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Upload not found")
          # Verify the upload still exists
          expect(Upload.find_by(id: other_upload.id)).to be_present
        end
      end
    end
  end
end
