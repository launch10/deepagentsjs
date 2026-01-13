# frozen_string_literal: true

# == Schema Information
#
# Table name: themes
#
#  id                         :bigint           not null, primary key
#  colors                     :jsonb
#  name                       :string           not null
#  pairings                   :jsonb
#  theme                      :jsonb
#  theme_type                 :string           not null
#  typography_recommendations :jsonb
#  created_at                 :datetime         not null
#  updated_at                 :datetime         not null
#  author_id                  :bigint
#
# Indexes
#
#  index_themes_on_author_id   (author_id)
#  index_themes_on_name        (name)
#  index_themes_on_theme_type  (theme_type)
#

require "rails_helper"
require "sidekiq/testing"

RSpec.describe Theme do
  describe "validations" do
    it "requires theme_type to be present" do
      theme = Theme.new(name: "Test", theme_type: nil)
      expect(theme).not_to be_valid
      expect(theme.errors[:theme_type]).to include("can't be blank")
    end

    it "requires theme_type to be community or official" do
      theme = Theme.new(name: "Test", theme_type: "invalid")
      expect(theme).not_to be_valid
      expect(theme.errors[:theme_type]).to include("is not included in the list")
    end

    it "requires author for community themes" do
      theme = Theme.new(name: "Test", theme_type: "community", author: nil)
      expect(theme).not_to be_valid
      expect(theme.errors[:author]).to include("must be present for community themes")
    end

    it "does not require author for official themes" do
      theme = Theme.new(name: "Test", theme_type: "official", author: nil)
      expect(theme).to be_valid
    end
  end

  describe "author assignment" do
    let(:account) { create(:account) }

    it "sets theme_type to community when author is assigned" do
      theme = Theme.new(name: "Test", theme_type: "official")
      theme.author = account
      expect(theme.theme_type).to eq("community")
    end

    it "raises error if author is not an Account" do
      theme = Theme.new(name: "Test")
      expect { theme.author = "not an account" }.to raise_error(ArgumentError, "Author must be an Account")
    end
  end

  describe "before_save :save_semantic_variables callback" do
    let(:account) { create(:account) }
    let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }

    context "with community themes" do
      it "expands colors to theme when theme is blank" do
        theme = Theme.new(
          name: "My Community Theme",
          colors: colors,
          author: account
        )

        expect(theme.theme).to be_blank
        theme.save!

        expect(theme.theme).to be_present
        expect(theme.theme["--primary"]).to match(/^\d+ \d+% \d+%$/)
        expect(theme.theme["--background"]).to match(/^\d+ \d+% \d+%$/)
        expect(theme.theme["--secondary"]).to match(/^\d+ \d+% \d+%$/)
      end

      it "regenerates theme when colors change even if theme exists" do
        existing_theme = {"--primary" => "200 50% 50%"}
        theme = Theme.new(
          name: "My Community Theme",
          colors: colors,
          theme: existing_theme,
          author: account
        )

        theme.save!
        # Theme should be regenerated from colors, not kept as existing
        expect(theme.theme).not_to eq(existing_theme)
        expect(theme.theme["--primary"]).to match(/^\d+ \d+% \d+%$/)
        expect(theme.theme["--background"]).to match(/^\d+ \d+% \d+%$/)
      end
    end

    context "with official themes" do
      it "expands colors to theme when theme is blank" do
        theme = Theme.new(
          name: "My Official Theme",
          colors: colors,
          theme_type: "official",
          theme: nil
        )

        theme.save!

        expect(theme.theme).to be_present
        expect(theme.theme["--primary"]).to match(/^\d+ \d+% \d+%$/)
        expect(theme.theme["--background"]).to match(/^\d+ \d+% \d+%$/)
      end

      it "regenerates theme when colors change even if theme exists" do
        existing_theme = {"--primary" => "10 100% 60%", "--background" => "0 0% 100%"}
        theme = Theme.new(
          name: "Official Theme",
          colors: colors,
          theme_type: "official",
          theme: existing_theme
        )

        theme.save!
        # Theme should be regenerated from colors, not kept as existing
        expect(theme.theme).not_to eq(existing_theme)
        expect(theme.theme["--primary"]).to match(/^\d+ \d+% \d+%$/)
        expect(theme.theme["--background"]).to match(/^\d+ \d+% \d+%$/)
      end
    end

    context "callback trigger conditions" do
      it "only runs when colors change" do
        theme = create(:theme, :community)
        original_theme = theme.theme.dup

        theme.update!(name: "Renamed Theme")
        expect(theme.theme).to eq(original_theme)
      end

      it "runs when colors are updated on existing record with blank theme" do
        theme = create(:theme, :official_without_theme)
        expect(theme.theme).to be_blank

        theme.update!(colors: colors)

        expect(theme.theme).to be_present
        expect(theme.theme["--primary"]).to match(/^\d+ \d+% \d+%$/)
      end

      it "does not run when colors are blank" do
        theme = Theme.new(
          name: "Empty Colors Theme",
          colors: [],
          theme_type: "official"
        )

        theme.save!
        expect(theme.theme).to be_blank
      end

      it "does not run when colors are nil" do
        theme = Theme.new(
          name: "Nil Colors Theme",
          colors: nil,
          theme_type: "official"
        )

        theme.save!
        expect(theme.theme).to be_blank
      end
    end

    context "generated CSS variables" do
      it "includes all required semantic roles" do
        theme = Theme.new(
          name: "Full Theme",
          colors: colors,
          author: account
        )
        theme.save!

        expect(theme.theme.keys).to include(
          "--primary", "--primary-foreground",
          "--secondary", "--secondary-foreground",
          "--accent", "--accent-foreground",
          "--muted", "--muted-foreground",
          "--background", "--foreground",
          "--card", "--card-foreground",
          "--popover", "--popover-foreground",
          "--destructive", "--destructive-foreground",
          "--border", "--input", "--ring"
        )
      end

      it "generates raw HSL color values (shadcn format without hsl() wrapper)" do
        theme = Theme.new(
          name: "HSL Theme",
          colors: colors,
          author: account
        )
        theme.save!

        theme.theme.each do |key, value|
          next if key.start_with?("--neutral") # Neutrals are static

          expect(value).to match(/^\d+ \d+% \d+%$/), "Expected #{key} to be raw HSL format, got: #{value}"
        end
      end
    end
  end

  describe "scopes" do
    let(:account) { create(:account) }

    before do
      create(:theme, :official)
      create(:theme, :community, author: account)
    end

    it ".official returns only official themes" do
      expect(Theme.official.count).to eq(1)
      expect(Theme.official.first.theme_type).to eq("official")
    end

    it ".community returns only community themes" do
      expect(Theme.community.count).to eq(1)
      expect(Theme.community.first.theme_type).to eq("community")
    end

    it ".author returns themes by a specific account" do
      expect(Theme.author(account.id).count).to eq(1)
      expect(Theme.author(account.id).first.author).to eq(account)
    end
  end

  describe "#compute_pairings" do
    let(:account) { create(:account) }
    let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }

    it "delegates to SemanticVariables concern" do
      theme = Theme.new(name: "Test", colors: colors, theme_type: "official")

      result = theme.compute_pairings
      expect(result).to be_a(Hash)
      expect(result.keys).to include("264653", "2A9D8F", "E9C46A", "F4A261", "E76F51")
    end

    it "accepts custom min_contrast parameter" do
      theme = Theme.new(name: "Test", colors: %w[FFFFFF 000000 808080], theme_type: "official")

      strict_result = theme.compute_pairings(min_contrast: 7.0)
      lenient_result = theme.compute_pairings(min_contrast: 3.0)

      strict_total = strict_result.values.flatten.count
      lenient_total = lenient_result.values.flatten.count

      expect(lenient_total).to be > strict_total
    end

    it "returns empty hash when colors are blank" do
      theme = Theme.new(name: "Test", colors: [], theme_type: "official")
      expect(theme.compute_pairings).to eq({})
    end
  end

  describe "pairings persistence" do
    let(:account) { create(:account) }
    let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }

    it "saves pairings when theme is created with colors" do
      theme = Theme.new(
        name: "Theme with pairings",
        colors: colors,
        theme_type: "official"
      )

      expect(theme.pairings).to be_blank
      theme.save!

      expect(theme.pairings).to be_present
      expect(theme.pairings).to be_a(Hash)
    end

    it "includes color pairings with contrast ratios" do
      theme = Theme.create!(
        name: "Theme with pairings",
        colors: colors,
        theme_type: "official"
      )

      # Check that pairings have the expected structure
      theme.pairings.each do |color, pairs|
        expect(color).to be_a(String)
        pairs.each do |pair|
          expect(pair).to have_key("color")
          expect(pair).to have_key("contrast_ratio")
          expect(pair).to have_key("level")
        end
      end
    end

    it "regenerates pairings when colors change" do
      theme = create(:theme, :official)
      original_pairings = theme.pairings.dup

      new_colors = %w[FFFFFF 000000 FF0000]
      theme.update!(colors: new_colors)

      expect(theme.pairings).not_to eq(original_pairings)
      expect(theme.pairings.keys).to include("FFFFFF", "000000", "FF0000")
    end

    it "does not update pairings when non-color attributes change" do
      theme = create(:theme, :official)
      original_pairings = theme.pairings.dup

      theme.update!(name: "Renamed Theme")
      expect(theme.pairings).to eq(original_pairings)
    end

    it "includes standard foreground colors in pairings" do
      theme = Theme.create!(
        name: "Theme with foregrounds",
        colors: %w[264653],
        theme_type: "official"
      )

      # Should include light and dark foreground colors
      expect(theme.pairings.keys).to include("FAFAFA", "0A0A0A")
    end
  end

  describe "theme propagation to websites" do
    let(:account) { create(:account) }
    let(:theme) { create(:theme, :official) }
    let(:template_index_css) { File.read(Rails.root.join("templates/default/src/index.css")) }

    before do
      Sidekiq::Testing.fake!
    end

    after do
      Sidekiq::Worker.clear_all
    end

    it "enqueues a worker to propagate theme changes" do
      project = create(:project, account: account)
      create(:website, project: project, account: account, theme: theme)

      expect {
        theme.update!(colors: %w[FF0000 00FF00 0000FF FFFF00 FF00FF])
      }.to change(Themes::PropagateToWebsitesWorker.jobs, :size).by(1)

      job = Themes::PropagateToWebsitesWorker.jobs.last
      expect(job["args"]).to eq([theme.id])
    end

    it "propagates theme changes to all websites using the theme" do
      # Create websites using this theme
      project1 = create(:project, account: account)
      project2 = create(:project, account: account)
      website1 = create(:website, project: project1, account: account, theme: theme)
      website2 = create(:website, project: project2, account: account, theme: theme)

      # Give them index.css files
      website1.website_files.create!(path: "src/index.css", content: template_index_css)
      website2.website_files.create!(path: "src/index.css", content: template_index_css)

      # Update the theme colors and run both batch and individual workers inline
      new_colors = %w[FF0000 00FF00 0000FF FFFF00 FF00FF]
      Sidekiq::Testing.inline! do
        theme.update!(colors: new_colors)
      end

      # Both websites should have updated CSS
      css1 = website1.website_files.find_by(path: "src/index.css").reload.content
      css2 = website2.website_files.find_by(path: "src/index.css").reload.content

      # The new theme should be reflected in both
      expect(css1).to include("--primary:")
      expect(css2).to include("--primary:")

      # And they should match
      expect(css1).to eq(css2)
    end

    it "does not enqueue worker when non-theme attributes change" do
      project = create(:project, account: account)
      create(:website, project: project, account: account, theme: theme)

      expect {
        theme.update!(name: "Renamed Theme")
      }.not_to change(Themes::PropagateToWebsitesWorker.jobs, :size)
    end
  end
end
