require 'swagger_helper'

RSpec.describe "Website Files API", type: :request do
  let(:fake_embedding) { Array.new(1536) { rand(-1.0..1.0) } }
  let!(:template) { Template.first || create(:template) }
  let!(:user1) { create(:user, name: "User 1") }
  let!(:user2) { create(:user, name: "User 2") }

  let!(:user1_owned_account) { user1.owned_account }
  let!(:user1_team_account) { create_account_with_user(user1, account_name: "User 1 Team Account") }
  let!(:user2_owned_account) { user2.owned_account }

  let!(:project1_owned) { create(:project, account: user1_owned_account, name: "Project in Owned Account") }
  let!(:project1_team) { create(:project, account: user1_team_account, name: "Project in Team Account") }
  let!(:project2_owned) { create(:project, account: user2_owned_account, name: "User 2 Project") }

  let!(:website1_owned) { create(:website, account: user1_owned_account, project: project1_owned, template: template, id: 1) }
  let!(:website1_team) { create(:website, account: user1_team_account, project: project1_team, template: template, id: 2) }
  let!(:website2_owned) { create(:website, account: user2_owned_account, project: project2_owned, template: template, id: 3) }

  before do
    ensure_plans_exist
    subscribe_account(user1_owned_account, plan_name: 'pro')
    subscribe_account(user1_team_account, plan_name: 'pro')
    subscribe_account(user2_owned_account, plan_name: 'pro')
  end

  path '/api/v1/websites/{id}/files/write' do
    parameter name: :id, in: :path, type: :number, description: 'Website ID'

    post 'Creates or updates website files in bulk' do
      tags 'Website Files'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :files_params, in: :body, schema: APISchemas::WebsiteFile.write_params_schema

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'files created successfully' do
        schema APISchemas::WebsiteFile.write_response
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let(:files_params) do
          {
            files: [
              { path: "/index.html", content: "<h1>Hello</h1>" },
              { path: "/styles.css", content: "body { color: red; }" }
            ]
          }
        end

        before do
          Embeddable.generate_in_test = true
          allow(EmbeddingService).to receive(:generate).and_return(fake_embedding)
        end

        after do
          Embeddable.generate_in_test = false
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["files"].length).to eq(2)
          expect(data["files"].map { |f| f["path"] }).to contain_exactly("index.html", "styles.css")

          expect(website1_owned.website_files.count).to eq(2)
          expect(EmbeddingService).to have_received(:generate).twice
          expect(website1_owned.website_files.reload.map(&:embedding).map(&:count)).to all(eq fake_embedding.count)
        end
      end

      response '200', 'files updated when path already exists' do
        schema APISchemas::WebsiteFile.write_response
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let!(:existing_file) { create(:website_file, website: website1_owned, path: "index.html", content: "<h1>Old</h1>") }
        let(:files_params) do
          {
            files: [
              { path: "/index.html", content: "<h1>New Content</h1>" }
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["files"].length).to eq(1)
          expect(data["files"][0]["content"]).to eq("<h1>New Content</h1>")

          existing_file.reload
          expect(existing_file.content).to eq("<h1>New Content</h1>")
        end
      end

      response '200', 'creates new and updates existing files in same request' do
        schema APISchemas::WebsiteFile.write_response
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let!(:existing_file) { create(:website_file, website: website1_owned, path: "index.html", content: "<h1>Old</h1>") }
        let(:files_params) do
          {
            files: [
              { path: "/index.html", content: "<h1>Updated</h1>" },
              { path: "/new-file.js", content: "console.log('hello');" }
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["files"].length).to eq(2)

          expect(website1_owned.website_files.count).to eq(2)
          expect(website1_owned.website_files.find_by(path: "index.html").content).to eq("<h1>Updated</h1>")
          expect(website1_owned.website_files.find_by(path: "new-file.js").content).to eq("console.log('hello');")
        end
      end

      response '200', 'files created in team account after switching' do
        schema APISchemas::WebsiteFile.write_response
        let(:id) { website1_team.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-456" }
        let(:files_params) do
          {
            files: [
              { path: "/team-file.html", content: "<h1>Team Content</h1>" }
            ]
          }
        end

        before do
          switch_account_to(user1_team_account)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["files"].length).to eq(1)
          expect(website1_team.website_files.count).to eq(1)
        end
      end

      response '404', 'website not found in current account' do
        let(:id) { website1_team.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-456" }
        let(:files_params) do
          {
            files: [
              { path: "/index.html", content: "<h1>Test</h1>" }
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Website not found")
        end
      end

      response '404', 'cannot access other users website' do
        let(:id) { website2_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-789" }
        let(:files_params) do
          {
            files: [
              { path: "/index.html", content: "<h1>Hacked</h1>" }
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Website not found")

          expect(website2_owned.website_files.count).to eq(0)
        end
      end

      response '401', 'unauthorized - missing token' do
        let(:id) { website1_owned.id }
        let(:Authorization) { nil }
        let(:thread_id) { "thread-123" }
        let(:files_params) do
          {
            files: [
              { path: "/index.html", content: "<h1>Test</h1>" }
            ]
          }
        end

        run_test! do |response|
          expect(response.code).to eq("401")
        end
      end

      response '422', 'invalid request - files must be array' do
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let(:files_params) do
          {
            files: "not an array"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("files must be an array")
        end
      end

      response '422', 'invalid request - missing path or content' do
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let(:files_params) do
          {
            files: [
              { path: "/index.html" }
            ]
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Each file must have path and content")
        end
      end
    end
  end

  path '/api/v1/websites/{id}/files/edit' do
    parameter name: :id, in: :path, type: :number, description: 'Website ID'

    patch 'Edits a website file by replacing string occurrences' do
      tags 'Website Files'
      consumes 'application/json'
      produces 'application/json'
      security [bearer_auth: []]
      parameter name: :Authorization, in: :header, type: :string, required: false
      parameter name: 'X-Signature', in: :header, type: :string, required: false
      parameter name: 'X-Timestamp', in: :header, type: :string, required: false

      parameter name: :edit_params, in: :body, schema: APISchemas::WebsiteFile.edit_params_schema

      before do
        switch_account_to(user1_owned_account)
      end

      response '200', 'file edited successfully' do
        schema APISchemas::WebsiteFile.edit_response
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let!(:existing_file) { create(:website_file, website: website1_owned, path: "index.html", content: "<h1>Hello World</h1>") }
        let(:edit_params) do
          {
            path: "/index.html",
            old_string: "Hello World",
            new_string: "Goodbye World"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["file"]["content"]).to eq("<h1>Goodbye World</h1>")
          expect(data["occurrences"]).to eq(1)

          existing_file.reload
          expect(existing_file.content).to eq("<h1>Goodbye World</h1>")
        end
      end

      response '200', 'replaces all occurrences when replace_all is true' do
        schema APISchemas::WebsiteFile.edit_response
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let!(:existing_file) { create(:website_file, website: website1_owned, path: "index.html", content: "<div>foo</div><div>foo</div>") }
        let(:edit_params) do
          {
            path: "/index.html",
            old_string: "foo",
            new_string: "bar",
            replace_all: true
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["file"]["content"]).to eq("<div>bar</div><div>bar</div>")
          expect(data["occurrences"]).to eq(2)
        end
      end

      response '422', 'fails when multiple occurrences without replace_all' do
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let!(:existing_file) { create(:website_file, website: website1_owned, path: "index.html", content: "<div>foo</div><div>foo</div>") }
        let(:edit_params) do
          {
            path: "/index.html",
            old_string: "foo",
            new_string: "bar"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"][0]).to include("appears 2 times")
        end
      end

      response '422', 'fails when string not found' do
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let!(:existing_file) { create(:website_file, website: website1_owned, path: "index.html", content: "<h1>Hello</h1>") }
        let(:edit_params) do
          {
            path: "/index.html",
            old_string: "not found",
            new_string: "replacement"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"][0]).to include("String not found")
        end
      end

      response '404', 'file not found' do
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let(:edit_params) do
          {
            path: "/nonexistent.html",
            old_string: "foo",
            new_string: "bar"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"][0]).to include("File not found")
        end
      end

      response '404', 'website not found' do
        let(:id) { 999999 }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "nonexistent-thread" }
        let(:edit_params) do
          {
            path: "/index.html",
            old_string: "foo",
            new_string: "bar"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("Website not found")
        end
      end

      response '422', 'missing required params' do
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let(:edit_params) do
          {
            path: "/index.html"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["errors"]).to include("path, old_string, and new_string are required")
        end
      end

      response '200', 'creates website_file from template_file when file not yet customized' do
        schema APISchemas::WebsiteFile.edit_response
        let(:id) { website1_owned.id }
        let(:Authorization) { auth_headers_for(user1)['Authorization'] }
        let(:"X-Signature") { auth_headers_for(user1)['X-Signature'] }
        let(:"X-Timestamp") { auth_headers_for(user1)['X-Timestamp'] }
        let(:thread_id) { "thread-123" }
        let!(:template_file) { create(:template_file, template: template, path: "src/pages/IndexPage.tsx", content: "<div>Template Content</div>") }
        let(:edit_params) do
          {
            path: "src/pages/IndexPage.tsx",
            old_string: "Template Content",
            new_string: "Custom Content"
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["file"]["content"]).to eq("<div>Custom Content</div>")
          expect(data["occurrences"]).to eq(1)

          # Verify website_file was created
          website_file = website1_owned.website_files.find_by(path: "src/pages/IndexPage.tsx")
          expect(website_file).to be_present
          expect(website_file.content).to eq("<div>Custom Content</div>")

          # Verify template_file was NOT modified
          template_file.reload
          expect(template_file.content).to eq("<div>Template Content</div>")
        end
      end
    end
  end
end
