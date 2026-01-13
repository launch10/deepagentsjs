require "rails_helper"

RSpec.describe WebsiteConcerns::ThemeCssInjection do
  let(:account) { FactoryBot.create(:account) }
  let(:project) { FactoryBot.create(:project, account: account) }
  let(:template) { FactoryBot.create(:template) }
  let(:theme) { FactoryBot.create(:theme, colors: %w[264653 2A9D8F E9C46A F4A261 E76F51]) }
  let(:website) { FactoryBot.create(:website, project: project, account: account, template: template) }

  # Load the actual template index.css
  let(:template_index_css) do
    File.read(Rails.root.join("templates/default/src/index.css"))
  end

  before do
    # Simulate the website having an index.css from the template
    website.website_files.create!(path: "src/index.css", content: template_index_css)
  end

  describe "surgical theme CSS injection" do
    context "when theme_id changes" do
      it "replaces only the :root block contents" do
        website.update!(theme: theme)

        css_file = website.website_files.find_by(path: "src/index.css")

        # Should preserve structure outside :root
        expect(css_file.content).to include("@tailwind base;")
        expect(css_file.content).to include(".dark {")
        expect(css_file.content).to include("@apply border-border;")
        expect(css_file.content).to include("bg-background text-foreground")
      end

      it "injects theme variables into :root block" do
        website.update!(theme: theme)

        css_file = website.website_files.find_by(path: "src/index.css")

        # Should include CSS variables from theme.theme
        expect(css_file.content).to include("--background:")
        expect(css_file.content).to include("--foreground:")
        expect(css_file.content).to include("--primary:")
        expect(css_file.content).to include("--primary-foreground:")
      end

      it "generates raw HSL values without hsl() wrapper" do
        website.update!(theme: theme)

        css_file = website.website_files.find_by(path: "src/index.css")

        # Extract just the :root block to check
        root_match = css_file.content.match(/:root\s*\{([^}]*)\}/m)
        root_content = root_match[1]

        # Variables should be raw HSL like "180 50% 30%", NOT "hsl(180, 50%, 30%)"
        expect(root_content).not_to include("hsl(")

        # Should match pattern: --variable: H S% L%;
        expect(root_content).to match(/--primary:\s*\d+\s+\d+%\s+\d+%;/)
        expect(root_content).to match(/--background:\s*\d+\s+\d+%\s+\d+%;/)
      end

      it "updates :root when theme changes" do
        website.update!(theme: theme)
        original_content = website.website_files.find_by(path: "src/index.css").content

        new_theme = FactoryBot.create(:theme, colors: %w[FF0000 00FF00 0000FF FFFF00 FF00FF])
        website.update!(theme: new_theme)

        updated_content = website.website_files.find_by(path: "src/index.css").content
        expect(updated_content).not_to eq(original_content)

        # Structure should still be preserved
        expect(updated_content).to include(".dark {")
        expect(updated_content).to include("@apply border-border;")
      end
    end

    context "when theme_id does not change" do
      it "does not update CSS file" do
        website.update!(theme: theme)
        original_updated_at = website.website_files.find_by(path: "src/index.css").updated_at

        website.update!(name: "New Name")

        css_file = website.website_files.find_by(path: "src/index.css")
        expect(css_file.updated_at).to eq(original_updated_at)
      end
    end

    context "when theme is set to nil" do
      it "does not modify CSS" do
        website.update!(theme: theme)
        content_with_theme = website.website_files.find_by(path: "src/index.css").content

        website.update!(theme: nil)

        css_file = website.website_files.find_by(path: "src/index.css")
        expect(css_file.content).to eq(content_with_theme)
      end
    end

    context "when index.css does not exist in website_files" do
      before do
        website.website_files.find_by(path: "src/index.css").destroy
      end

      context "but exists in template_files" do
        before do
          template.files.create!(path: "src/index.css", content: template_index_css)
        end

        it "creates website_file from template and injects theme" do
          expect {
            website.update!(theme: theme)
          }.to change { website.website_files.count }.by(1)

          css_file = website.website_files.find_by(path: "src/index.css")
          expect(css_file).to be_present
          expect(css_file.content).to include("--primary:")
          expect(css_file.content).to include("@tailwind base;")
        end
      end

      context "and does not exist in template_files" do
        it "does nothing" do
          expect {
            website.update!(theme: theme)
          }.not_to change { website.website_files.count }
        end
      end
    end
  end

  describe "#inject_theme_css!" do
    it "can be called directly to update CSS" do
      website.update_column(:theme_id, theme.id)
      website.reload

      website.inject_theme_css!

      css_file = website.website_files.find_by(path: "src/index.css")
      expect(css_file.content).to include("--primary:")
    end

    it "does nothing if theme has no theme variables" do
      empty_theme = FactoryBot.create(:theme, theme_type: "official")
      empty_theme.update_column(:theme, nil)
      website.update_column(:theme_id, empty_theme.id)
      website.reload

      original_content = website.website_files.find_by(path: "src/index.css").content

      website.inject_theme_css!

      css_file = website.website_files.find_by(path: "src/index.css")
      expect(css_file.content).to eq(original_content)
    end
  end

  describe "generated CSS variables" do
    it "includes all required shadcn semantic variables" do
      website.update!(theme: theme)

      css_file = website.website_files.find_by(path: "src/index.css")
      root_match = css_file.content.match(/:root\s*\{([^}]*)\}/m)
      root_content = root_match[1]

      # Core shadcn variables
      %w[
        --background --foreground
        --primary --primary-foreground
        --secondary --secondary-foreground
        --muted --muted-foreground
        --accent --accent-foreground
        --card --card-foreground
        --popover --popover-foreground
        --destructive --destructive-foreground
        --border --input --ring
      ].each do |var|
        expect(root_content).to include("#{var}:"), "Expected :root to include #{var}"
      end
    end
  end
end
