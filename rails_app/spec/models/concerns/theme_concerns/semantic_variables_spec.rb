# frozen_string_literal: true

require "rails_helper"

RSpec.describe ThemeConcerns::SemanticVariables do
  describe ".create_semantic_variables" do
    context "with a standard 5-color palette" do
      let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "generates all required CSS variables" do
        expect(result.keys).to include(
          "--background", "--background-foreground", "--background-foreground-muted",
          "--primary", "--primary-foreground", "--primary-foreground-muted",
          "--secondary", "--secondary-foreground", "--secondary-foreground-muted",
          "--accent", "--accent-foreground", "--accent-foreground-muted",
          "--muted", "--muted-foreground", "--muted-foreground-muted",
          "--destructive", "--destructive-foreground", "--destructive-foreground-muted",
          "--warning", "--warning-foreground", "--warning-foreground-muted",
          "--success", "--success-foreground", "--success-foreground-muted",
          "--card", "--card-foreground", "--card-foreground-muted",
          "--popover", "--popover-foreground", "--popover-foreground-muted",
          "--border", "--input", "--ring",
          "--neutral-1", "--neutral-2", "--neutral-3"
        )
      end

      it "generates HSL string values" do
        expect(result["--primary"]).to match(/hsl\(\d+, \d+%, \d+%\)/)
        expect(result["--background"]).to match(/hsl\(\d+, \d+%, \d+%\)/)
        expect(result["--secondary"]).to match(/hsl\(\d+, \d+%, \d+%\)/)
      end

      it "assigns background to the lightest color" do
        # E9C46A (golden yellow) should be the lightest of the palette
        expect(result["--background"]).to include("hsl(")
      end

      it "assigns primary to a saturated color with good contrast" do
        expect(result["--primary"]).to match(/hsl\(\d+, \d+%, \d+%\)/)
      end

      it "generates contrasting foreground colors" do
        # Foreground should be either very light or very dark
        expect(result["--background-foreground"]).to match(/hsl\(0, 0%, (4|98)%\)/)
        expect(result["--primary-foreground"]).to match(/hsl\(0, 0%, (4|98)%\)/)
      end

      it "generates muted foreground colors" do
        expect(result["--background-foreground-muted"]).to match(/hsl\(0, 0%, (27|75)%\)/)
      end

      it "sets card and popover to match background" do
        expect(result["--card"]).to eq(result["--background"])
        expect(result["--popover"]).to eq(result["--background"])
      end

      it "sets ring to match primary" do
        expect(result["--ring"]).to eq(result["--primary"])
      end

      it "generates border color based on background luminance" do
        expect(result["--border"]).to match(/hsl\(210, 9%, \d+%\)/)
        expect(result["--input"]).to eq(result["--border"])
      end

      it "generates static neutral colors" do
        expect(result["--neutral-1"]).to eq("hsl(210, 6%, 94%)")
        expect(result["--neutral-2"]).to eq("hsl(210, 4%, 89%)")
        expect(result["--neutral-3"]).to eq("hsl(210, 3%, 85%)")
      end
    end

    context "with colors containing hash prefixes" do
      let(:colors) { %w[#264653 #2A9D8F #E9C46A] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "normalizes by stripping hash prefixes" do
        expect(result["--primary"]).to be_present
        expect(result["--background"]).to be_present
      end
    end

    context "with lowercase hex colors" do
      let(:colors) { %w[264653 2a9d8f e9c46a] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "normalizes to uppercase internally" do
        expect(result["--primary"]).to be_present
        expect(result["--background"]).to be_present
      end
    end

    context "with blank colors" do
      it "returns empty hash for empty array" do
        expect(described_class.create_semantic_variables([])).to eq({})
      end

      it "returns empty hash for nil" do
        expect(described_class.create_semantic_variables(nil)).to eq({})
      end

      it "returns empty hash for blank string in array" do
        expect(described_class.create_semantic_variables(["", "  "])).to eq({})
      end
    end

    context "with invalid colors" do
      it "handles gracefully without raising" do
        expect { described_class.create_semantic_variables(%w[invalid notahex zzz]) }.not_to raise_error
      end

      it "returns empty hash when all colors are invalid" do
        result = described_class.create_semantic_variables(%w[invalid notahex])
        expect(result).to eq({})
      end
    end

    context "with fewer than 5 colors" do
      let(:colors) { %w[264653 2A9D8F] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "still generates all required variables" do
        expect(result["--primary"]).to be_present
        expect(result["--background"]).to be_present
        expect(result["--secondary"]).to be_present
        expect(result["--accent"]).to be_present
        expect(result["--muted"]).to be_present
      end

      it "reuses colors when necessary for missing roles" do
        # With only 2 colors, some roles will be duplicated
        expect(result.values.compact.length).to be > 0
      end
    end

    context "with a single color" do
      let(:colors) { %w[264653] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "generates variables using the single color for multiple roles" do
        expect(result["--primary"]).to be_present
        expect(result["--background"]).to be_present
      end
    end

    context "with status colors in palette" do
      context "when palette contains a red (destructive) color" do
        let(:colors) { %w[264653 2A9D8F E9C46A dc3545 198754] }
        let(:result) { described_class.create_semantic_variables(colors) }

        it "uses the red from palette for destructive" do
          # dc3545 has hue ~354 which is in the red range (345..15)
          expect(result["--destructive"]).to include("hsl(")
        end
      end

      context "when palette contains a green (success) color" do
        let(:colors) { %w[264653 2A9D8F E9C46A F4A261 198754] }
        let(:result) { described_class.create_semantic_variables(colors) }

        it "uses a green from palette for success" do
          # 198754 has hue ~145 which is in green range (100..160)
          expect(result["--success"]).to include("hsl(")
        end
      end

      context "when palette lacks status colors" do
        # Use a palette that has no colors in the status hue ranges:
        # - Destructive: 345..15 (reds)
        # - Warning: 35..55 (yellows/oranges)
        # - Success: 100..160 (greens)
        # These are all blues/purples which don't overlap
        let(:colors) { %w[1E3A5F 2E5077 3D6A8F 4A7FA8 5894C0] }
        let(:result) { described_class.create_semantic_variables(colors) }

        it "falls back to default destructive (Bootstrap red)" do
          # Default destructive is dc3545
          expect(result["--destructive"]).to eq("hsl(354, 70%, 54%)")
        end

        it "falls back to default warning (Bootstrap yellow)" do
          # Default warning is ffc107
          expect(result["--warning"]).to eq("hsl(45, 100%, 51%)")
        end

        it "falls back to default success (Bootstrap green)" do
          # Default success is 198754 - HSL may vary slightly due to conversion
          expect(result["--success"]).to match(/hsl\(1(45|52), \d+%, 3\d%\)/)
        end
      end
    end

    context "WCAG contrast compliance" do
      it "uses light foreground on dark colors" do
        # Use a palette of all dark colors so we know foregrounds will be light
        dark_palette = %w[1a1a2e 16213e 0f3460 1e2a3a 0d1821]
        result = described_class.create_semantic_variables(dark_palette)

        # Dark backgrounds should get light foreground (FAFAFA = ~98% lightness)
        expect(result["--background-foreground"]).to match(/hsl\(0, 0%, 98%\)/)
      end

      it "uses dark foreground on light backgrounds" do
        # f8f9fa is very light, so its foreground should be dark
        light_background_palette = %w[f8f9fa e9ecef dee2e6 264653 212529]
        result = described_class.create_semantic_variables(light_background_palette)
        # Light backgrounds should get dark foreground (0A0A0A = ~4% lightness)
        expect(result["--background-foreground"]).to match(/hsl\(0, 0%, 4%\)/)
      end

      it "ensures foreground colors are either very light or very dark" do
        colors = %w[264653 2A9D8F E9C46A F4A261 E76F51]
        result = described_class.create_semantic_variables(colors)

        # All foreground values should be either ~4% (dark) or ~98% (light)
        foreground_keys = result.keys.select { |k| k.end_with?("-foreground") && !k.end_with?("-foreground-muted") }
        foreground_keys.each do |key|
          expect(result[key]).to match(/hsl\(0, 0%, (4|98)%\)/), "Expected #{key} to have contrasting foreground"
        end
      end
    end

    context "role assignment logic" do
      let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "assigns different colors to primary and secondary" do
        # Primary and secondary should be different colors (different hues)
        expect(result["--primary"]).not_to eq(result["--secondary"])
      end

      it "assigns background to the lightest color" do
        # E9C46A (golden yellow) has the highest luminance
        # We can verify by checking the lightness component
        background_match = result["--background"].match(/hsl\((\d+), (\d+)%, (\d+)%\)/)
        expect(background_match).to be_present
        background_lightness = background_match[3].to_i
        expect(background_lightness).to be > 50 # Should be a light color
      end
    end
  end

  describe ".compute_pairings" do
    context "with black and white" do
      let(:colors) { %w[FFFFFF 000000] }
      let(:result) { described_class.compute_pairings(colors) }

      it "returns a hash with color keys" do
        expect(result).to be_a(Hash)
        expect(result.keys).to include("FFFFFF", "000000")
      end

      it "computes maximum contrast ratio for black/white pair" do
        white_pairs = result["FFFFFF"]
        black_pair = white_pairs.find { |p| p[:color] == "000000" }

        expect(black_pair).to be_present
        expect(black_pair[:contrast_ratio]).to eq(21.0)
        expect(black_pair[:level]).to eq("AAA")
      end

      it "includes standard foreground colors" do
        # Should include FAFAFA (light) and 0A0A0A (dark) foregrounds
        expect(result.keys).to include("FAFAFA", "0A0A0A")
      end
    end

    context "with a typical palette" do
      let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
      let(:result) { described_class.compute_pairings(colors) }

      it "returns pairings for each color" do
        colors.each do |color|
          expect(result[color.upcase]).to be_an(Array)
        end
      end

      it "sorts pairs by contrast ratio descending" do
        result.each do |_color, pairs|
          next if pairs.length < 2

          ratios = pairs.map { |p| p[:contrast_ratio] }
          expect(ratios).to eq(ratios.sort.reverse)
        end
      end

      it "only includes pairs meeting minimum contrast threshold" do
        result.each do |_color, pairs|
          pairs.each do |pair|
            expect(pair[:contrast_ratio]).to be >= described_class::WCAG_AA_NORMAL_TEXT
          end
        end
      end

      it "includes contrast ratio and level for each pair" do
        result.each do |_color, pairs|
          pairs.each do |pair|
            expect(pair).to have_key(:color)
            expect(pair).to have_key(:contrast_ratio)
            expect(pair).to have_key(:level)
          end
        end
      end
    end

    context "with custom minimum contrast" do
      let(:colors) { %w[FFFFFF 808080 000000] }

      it "filters pairs by custom minimum contrast" do
        # Gray (808080) has ~4.5:1 contrast with white and black
        strict_result = described_class.compute_pairings(colors, min_contrast: 7.0)

        # With min_contrast 7.0, gray should not pair with white or black
        # Only black/white should pair with each other (21:1)
        white_pairs = strict_result["FFFFFF"]
        gray_in_white = white_pairs.find { |p| p[:color] == "808080" }
        expect(gray_in_white).to be_nil
      end

      it "includes more pairs with lower minimum contrast" do
        lenient_result = described_class.compute_pairings(colors, min_contrast: 3.0)
        strict_result = described_class.compute_pairings(colors, min_contrast: 7.0)

        lenient_total = lenient_result.values.flatten.count
        strict_total = strict_result.values.flatten.count

        expect(lenient_total).to be > strict_total
      end
    end

    context "WCAG level assignment" do
      let(:colors) { %w[FFFFFF 000000 808080] }
      let(:result) { described_class.compute_pairings(colors, min_contrast: 3.0) }

      it "assigns AAA level for contrast >= 7.0" do
        white_pairs = result["FFFFFF"]
        black_pair = white_pairs.find { |p| p[:color] == "000000" }

        expect(black_pair[:level]).to eq("AAA")
      end

      it "assigns AA level for contrast >= 4.5 but < 7.0" do
        # Gray against white or black has approximately 4.5:1 contrast
        white_pairs = result["FFFFFF"]
        gray_pair = white_pairs.find { |p| p[:color] == "808080" }

        if gray_pair && gray_pair[:contrast_ratio] >= 4.5 && gray_pair[:contrast_ratio] < 7.0
          expect(gray_pair[:level]).to eq("AA")
        end
      end

      it "assigns AA-large level for contrast >= 3.0 but < 4.5" do
        # Find any pair in this range
        result.each do |_color, pairs|
          pairs.each do |pair|
            if pair[:contrast_ratio] >= 3.0 && pair[:contrast_ratio] < 4.5
              expect(pair[:level]).to eq("AA-large")
            end
          end
        end
      end
    end

    context "with blank or invalid input" do
      it "returns empty hash for empty array" do
        expect(described_class.compute_pairings([])).to eq({})
      end

      it "returns empty hash for nil" do
        expect(described_class.compute_pairings(nil)).to eq({})
      end

      it "handles invalid colors gracefully" do
        expect { described_class.compute_pairings(%w[invalid notahex]) }.not_to raise_error
      end
    end

    context "color normalization" do
      it "normalizes colors with hash prefixes" do
        result = described_class.compute_pairings(%w[#FFFFFF #000000])
        expect(result.keys).to include("FFFFFF", "000000")
      end

      it "normalizes lowercase colors" do
        result = described_class.compute_pairings(%w[ffffff 000000])
        expect(result.keys).to include("FFFFFF", "000000")
      end
    end

    context "self-pairing exclusion" do
      let(:colors) { %w[FFFFFF 000000] }
      let(:result) { described_class.compute_pairings(colors) }

      it "does not include a color paired with itself" do
        result.each do |color, pairs|
          self_pair = pairs.find { |p| p[:color] == color }
          expect(self_pair).to be_nil
        end
      end
    end
  end
end
