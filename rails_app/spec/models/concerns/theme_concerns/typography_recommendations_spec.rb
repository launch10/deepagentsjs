# frozen_string_literal: true

require "rails_helper"

RSpec.describe ThemeConcerns::TypographyRecommendations do
  let(:palette) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
  let(:pairings) { ThemeConcerns::SemanticVariables.compute_pairings(palette) }

  describe ".compute_recommendations" do
    let(:recommendations) { described_class.compute_recommendations(palette, pairings) }

    it "returns recommendations for each palette color as background" do
      palette.each do |color|
        next unless pairings[color]&.any?

        expect(recommendations).to have_key(color),
          "Missing recommendations for #{color}"
      end
    end

    it "includes headline recommendations" do
      recommendations.each do |bg_color, recs|
        expect(recs).to have_key(:headlines),
          "Missing headlines for #{bg_color}"
      end
    end

    it "includes subheadline recommendations" do
      recommendations.each do |bg_color, recs|
        expect(recs).to have_key(:subheadlines),
          "Missing subheadlines for #{bg_color}"
      end
    end

    it "includes body text recommendations" do
      recommendations.each do |bg_color, recs|
        expect(recs).to have_key(:body),
          "Missing body for #{bg_color}"
      end
    end

    it "includes accent recommendations" do
      recommendations.each do |bg_color, recs|
        expect(recs).to have_key(:accents),
          "Missing accents for #{bg_color}"
      end
    end

    context "recommendation structure" do
      it "includes color, contrast, level, and style for each recommendation" do
        recommendations.each do |_bg, recs|
          recs[:headlines]&.each do |rec|
            expect(rec).to include(:color, :contrast, :level, :style)
          end
        end
      end

      it "categorizes palette colors as 'bold' style" do
        recommendations.each do |_bg, recs|
          palette_headlines = recs[:headlines]&.select { |r| palette.include?(r[:color]) }
          palette_headlines&.each do |rec|
            expect(rec[:style]).to eq("bold"),
              "Palette color #{rec[:color]} should have 'bold' style"
          end
        end
      end

      it "categorizes standard colors as 'clear' style" do
        standard_colors = %w[FAFAFA 0A0A0A]
        recommendations.each do |_bg, recs|
          standard_headlines = recs[:headlines]&.select { |r| standard_colors.include?(r[:color]) }
          standard_headlines&.each do |rec|
            expect(rec[:style]).to eq("clear"),
              "Standard color #{rec[:color]} should have 'clear' style"
          end
        end
      end
    end

    context "headline recommendations" do
      it "prioritizes AAA contrast for headlines" do
        recommendations.each do |_bg, recs|
          next if recs[:headlines].blank?

          # First headline should be AAA if any AAA options exist
          aaa_available = recs[:headlines].any? { |r| r[:level] == "AAA" }
          if aaa_available
            expect(recs[:headlines].first[:level]).to eq("AAA")
          end
        end
      end

      it "includes both bold (palette) and clear (standard) options when available" do
        # Find a background that has both palette and standard pairings
        bg_with_options = recommendations.find do |_bg, recs|
          recs[:headlines]&.any? { |r| r[:style] == "bold" } &&
            recs[:headlines]&.any? { |r| r[:style] == "clear" }
        end

        if bg_with_options
          _bg, recs = bg_with_options
          bold_count = recs[:headlines].count { |r| r[:style] == "bold" }
          clear_count = recs[:headlines].count { |r| r[:style] == "clear" }
          expect(bold_count).to be >= 1
          expect(clear_count).to be >= 1
        end
      end
    end

    context "subheadline recommendations" do
      it "allows AA-large contrast level for subheadlines" do
        # Subheadlines can use AA-large since they're typically large text
        all_levels = recommendations.flat_map do |_bg, recs|
          recs[:subheadlines]&.map { |r| r[:level] } || []
        end.uniq

        # Should accept AA-large as valid for subheadlines
        expect(%w[AAA AA AA-large]).to include(*all_levels)
      end
    end

    context "body text recommendations" do
      it "prioritizes high contrast for body text" do
        recommendations.each do |_bg, recs|
          next if recs[:body].blank?

          # Body text should primarily use AAA or strong AA
          recs[:body].each do |rec|
            expect(%w[AAA AA]).to include(rec[:level]),
              "Body text should have AAA or AA contrast, got #{rec[:level]}"
          end
        end
      end

      it "includes standard colors for reliability" do
        standard_colors = %w[FAFAFA 0A0A0A]

        # At least some backgrounds should have standard color body recommendations
        has_standard_body = recommendations.any? do |_bg, recs|
          recs[:body]&.any? { |r| standard_colors.include?(r[:color]) }
        end

        expect(has_standard_body).to be true
      end
    end

    context "with empty input" do
      it "returns empty hash for blank colors" do
        expect(described_class.compute_recommendations([], pairings)).to eq({})
        expect(described_class.compute_recommendations(nil, pairings)).to eq({})
      end

      it "returns empty hash for blank pairings" do
        expect(described_class.compute_recommendations(palette, nil)).to eq({})
        expect(described_class.compute_recommendations(palette, {})).to eq({})
      end
    end
  end

  describe ".format_for_prompt" do
    let(:recommendations) { described_class.compute_recommendations(palette, pairings) }
    let(:formatted) { described_class.format_for_prompt(recommendations, palette) }

    it "returns a non-empty string" do
      expect(formatted).to be_a(String)
      expect(formatted.length).to be > 0
    end

    it "includes the palette colors" do
      palette.each do |color|
        expect(formatted).to include(color)
      end
    end

    it "includes section headers for headlines" do
      expect(formatted).to include("Headlines")
    end

    it "includes section headers for body text" do
      expect(formatted).to include("Body text")
    end

    it "includes contrast ratios" do
      expect(formatted).to match(/\d+\.\d+:1/)
    end

    it "includes WCAG levels" do
      expect(formatted).to match(/AAA|AA/)
    end

    it "indicates bold vs clear/standard colors" do
      expect(formatted).to match(/palette color|standard/)
    end

    it "returns empty string for blank recommendations" do
      expect(described_class.format_for_prompt({}, palette)).to eq("")
      expect(described_class.format_for_prompt(nil, palette)).to eq("")
    end
  end

  describe "integration with SemanticVariables pairings" do
    let(:dark_palette) { %w[1a1a2e 16213e 0f3460 e94560 ffffff] }
    let(:dark_pairings) { ThemeConcerns::SemanticVariables.compute_pairings(dark_palette) }
    let(:dark_recommendations) { described_class.compute_recommendations(dark_palette, dark_pairings) }

    it "works with dark palettes" do
      expect(dark_recommendations).not_to be_empty
    end

    it "recommends light colors on dark backgrounds" do
      dark_bg = "1A1A2E"
      recs = dark_recommendations[dark_bg]
      next unless recs

      # Headlines on dark background should include light colors
      headline_colors = recs[:headlines]&.map { |r| r[:color] } || []
      light_colors = %w[FFFFFF FAFAFA E94560]

      has_light = headline_colors.any? { |c| light_colors.include?(c.upcase) }
      expect(has_light).to be(true), "Expected light headline colors on dark background"
    end
  end
end
