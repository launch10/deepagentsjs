require 'rails_helper'

RSpec.describe Website, type: :model do
  describe "template file inheritance" do
    let(:user) { create(:user) }
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }
    let(:template) { create(:template, name: "test_template") }
    let(:website) { create(:website, account: account, project: project, template: template) }
    
    before do
      # Create template files
      template.files.create!(path: "index.html", content: "Template index")
      template.files.create!(path: "styles.css", content: "Template styles")
      template.files.create!(path: "script.js", content: "Template script")
      
      # Create website files (overriding some template files)
      website.website_files.create!(path: "index.html", content: "Website index")
      website.website_files.create!(path: "custom.css", content: "Custom styles")
    end
    
    describe "#files" do
      it "returns merged set of template and website files" do
        files = website.files
        expect(files.count).to eq(4) # 3 from template + 1 custom - 1 override
        
        paths = files.map(&:path)
        expect(paths).to include("index.html", "styles.css", "script.js", "custom.css")
      end
      
      it "prioritizes website files over template files" do
        index_file = website.files.find { |f| f.path == "index.html" }
        expect(index_file.content).to eq("Website index")
        expect(index_file).to be_a(WebsiteFile)
      end
      
      it "includes template files not overridden by website" do
        styles_file = website.files.find { |f| f.path == "styles.css" }
        expect(styles_file.content).to eq("Template styles")
        expect(styles_file).to be_a(TemplateFile)
      end
      
      it "includes website-only files" do
        custom_file = website.files.find { |f| f.path == "custom.css" }
        expect(custom_file.content).to eq("Custom styles")
        expect(custom_file).to be_a(WebsiteFile)
      end
    end
    
    describe "#template_files" do
      it "returns template files through association" do
        expect(website.template_files.count).to eq(3)
        expect(website.template_files).to all(be_a(TemplateFile))
      end
    end
    
    describe "#make_fixture_files" do
      let(:website_for_fixtures) { create(:website, account: account, project: project) }
      
      it "creates website files from fixtures" do
        expect {
          website_for_fixtures.make_fixture_files
        }.to change { website_for_fixtures.website_files.count }
        
        fixture_data = JSON.parse(File.read(Rails.root.join('spec/fixtures/valid_website_files.json')))
        expect(website_for_fixtures.website_files.count).to eq(fixture_data.count)
        
        paths = website_for_fixtures.website_files.map(&:path)
        fixture_paths = fixture_data.map { |f| f['path'] }
        expect(paths).to match_array(fixture_paths)
      end
      
      it "creates files with correct content" do
        website_for_fixtures.make_fixture_files
        
        fixture_data = JSON.parse(File.read(Rails.root.join('spec/fixtures/valid_website_files.json')))
        first_fixture = fixture_data.first
        
        created_file = website_for_fixtures.website_files.find_by(path: first_fixture['path'])
        expect(created_file.content).to eq(first_fixture['content'])
      end
    end
  end
  
  describe "nested attributes" do
    let(:user) { create(:user) }
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }
    let(:template) { create(:template) }
    
    it "accepts nested attributes for website_files" do
      website = Website.create!(
        name: "Test",
        thread_id: "thread_123",
        account: account,
        project: project,
        template: template,
        website_files_attributes: [
          { path: "index.html", content: "Hello" },
          { path: "styles.css", content: "body {}" }
        ]
      )
      
      expect(website.website_files.count).to eq(2)
      expect(website.website_files.map(&:path)).to include("index.html", "styles.css")
    end
  end
end