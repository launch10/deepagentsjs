require "rails_helper"

RSpec.describe ThemeConcerns::IndexCssGeneration do
  let(:account) { FactoryBot.create(:account) }
  let(:project) { FactoryBot.create(:project, account: account) }
  let(:template) { FactoryBot.create(:template) }

  describe "CSS generation on theme save" do
    context "when theme variables change" do
      it "generates index_css_content when theme column changes" do
        theme = FactoryBot.create(:theme, theme_type: "official")

        # Update colors which triggers theme column update
        theme.update!(colors: %w[264653 2A9D8F E9C46A F4A261 E76F51])

        expect(theme.reload.index_css_content).to be_present
        expect(theme.index_css_content).to include("@tailwind base")
        expect(theme.index_css_content).to include(":root")
      end

      it "includes CSS variables from theme in generated content" do
        theme = FactoryBot.create(:theme, colors: %w[264653 2A9D8F E9C46A F4A261 E76F51])

        css_content = theme.index_css_content
        expect(css_content).to include("--background")
        expect(css_content).to include("--primary")
      end
    end

    context "when theme has no variables" do
      it "does not generate CSS content" do
        theme = FactoryBot.build(:theme, theme_type: "official", colors: nil)
        theme.save(validate: false)
        theme.update_column(:theme, nil)
        theme.update_column(:index_css_content, nil)

        # Trigger save without theme data
        theme.update!(name: "Updated Name")

        expect(theme.index_css_content).to be_nil
      end
    end
  end

  describe "website CSS propagation" do
    let(:theme) { FactoryBot.create(:theme, colors: %w[264653 2A9D8F E9C46A F4A261 E76F51]) }
    let(:website) { FactoryBot.create(:website, project: project, account: account, template: template, theme: theme) }

    it "updates associated website CSS files when theme CSS changes" do
      # Ensure website has the CSS file
      website.inject_theme_css!
      original_content = website.website_files.find_by(path: "src/index.css").content

      # Update theme colors which regenerates CSS
      theme.update!(colors: %w[FF0000 00FF00 0000FF FFFF00 FF00FF])

      # Website should have updated content
      updated_content = website.reload.website_files.find_by(path: "src/index.css").content
      expect(updated_content).not_to eq(original_content)
      expect(updated_content).to eq(theme.reload.index_css_content)
    end

    it "updates multiple websites using the same theme" do
      website2 = FactoryBot.create(:website, project: project, account: account, template: template, theme: theme)

      # Ensure both websites have CSS files
      website.inject_theme_css!
      website2.inject_theme_css!

      # Update theme
      theme.update!(colors: %w[111111 222222 333333 444444 555555])

      # Both websites should have the same updated content
      content1 = website.reload.website_files.find_by(path: "src/index.css").content
      content2 = website2.reload.website_files.find_by(path: "src/index.css").content

      expect(content1).to eq(theme.reload.index_css_content)
      expect(content2).to eq(theme.reload.index_css_content)
    end
  end

  describe ".generate_root_variables" do
    it "groups CSS variables by category" do
      css_vars = {
        "--background" => "0 0% 100%",
        "--foreground" => "222.2 84% 4.9%",
        "--primary" => "221.2 83.2% 53.3%",
        "--primary-foreground" => "210 40% 98%",
        "--secondary" => "210 40% 96.1%",
        "--card" => "0 0% 100%",
        "--destructive" => "0 84.2% 60.2%"
      }

      result = Theme.generate_root_variables(css_vars)

      expect(result).to include("/* Background */")
      expect(result).to include("/* Primary */")
      expect(result).to include("/* Secondary */")
      expect(result).to include("/* UI Elements */")
      expect(result).to include("/* State Colors */")
    end

    it "formats variables correctly" do
      css_vars = { "--primary" => "221.2 83.2% 53.3%" }

      result = Theme.generate_root_variables(css_vars)

      expect(result).to include("--primary: 221.2 83.2% 53.3%;")
    end
  end

  describe "#generate_index_css" do
    let(:theme) { FactoryBot.create(:theme, colors: %w[264653 2A9D8F E9C46A F4A261 E76F51]) }

    it "generates valid Tailwind CSS with theme variables" do
      css = theme.generate_index_css

      expect(css).to include("@tailwind base;")
      expect(css).to include("@tailwind components;")
      expect(css).to include("@tailwind utilities;")
      expect(css).to include("@layer base")
      expect(css).to include(":root")
    end

    it "includes body styling" do
      css = theme.generate_index_css

      expect(css).to include("@apply bg-background text-foreground;")
      expect(css).to include("@apply border-border;")
    end

    it "returns nil when theme has no variables" do
      theme.update_column(:theme, nil)

      expect(theme.generate_index_css).to be_nil
    end
  end
end
