require "rails_helper"

RSpec.describe WebsiteConcerns::ThemeCssInjection do
  let(:account) { FactoryBot.create(:account) }
  let(:project) { FactoryBot.create(:project, account: account) }
  let(:template) { FactoryBot.create(:template) }
  let(:theme) { FactoryBot.create(:theme, colors: %w[264653 2A9D8F E9C46A F4A261 E76F51]) }
  let(:website) { FactoryBot.create(:website, project: project, account: account, template: template) }

  describe "theme CSS injection on website save" do
    context "when theme_id changes" do
      it "creates a website_file for src/index.css" do
        expect {
          website.update!(theme: theme)
        }.to change { website.website_files.where(path: "src/index.css").count }.by(1)
      end

      it "populates the CSS file with theme's index_css_content" do
        website.update!(theme: theme)

        css_file = website.website_files.find_by(path: "src/index.css")
        expect(css_file.content).to eq(theme.index_css_content)
      end

      it "updates existing CSS file when theme changes" do
        website.update!(theme: theme)
        original_content = website.website_files.find_by(path: "src/index.css").content

        new_theme = FactoryBot.create(:theme, colors: %w[FF0000 00FF00 0000FF FFFF00 FF00FF])
        website.update!(theme: new_theme)

        updated_content = website.website_files.find_by(path: "src/index.css").content
        expect(updated_content).not_to eq(original_content)
        expect(updated_content).to eq(new_theme.index_css_content)
      end
    end

    context "when theme_id does not change" do
      it "does not create or update CSS file" do
        website.update!(theme: theme)
        original_updated_at = website.website_files.find_by(path: "src/index.css").updated_at

        # Update something else
        website.update!(name: "New Name")

        css_file = website.website_files.find_by(path: "src/index.css")
        expect(css_file.updated_at).to eq(original_updated_at)
      end
    end

    context "when theme is set to nil" do
      it "does not inject CSS" do
        website.update!(theme: theme)

        expect {
          website.update!(theme: nil)
        }.not_to change { website.website_files.count }
      end
    end
  end

  describe "#inject_theme_css!" do
    it "can be called directly to update CSS" do
      website.update!(theme: theme)

      # Manually call inject
      website.inject_theme_css!

      css_file = website.website_files.find_by(path: "src/index.css")
      expect(css_file.content).to eq(theme.index_css_content)
    end

    it "does nothing if theme has no index_css_content" do
      empty_theme = FactoryBot.create(:theme, theme_type: "official")
      empty_theme.update_column(:index_css_content, nil)
      website.update_column(:theme_id, empty_theme.id)

      expect {
        website.inject_theme_css!
      }.not_to change { website.website_files.count }
    end
  end
end
