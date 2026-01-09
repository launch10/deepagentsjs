# frozen_string_literal: true

require "rails_helper"

RSpec.describe ThemeConcerns::SemanticVariables do
  # Helper to extract HSL components from a CSS HSL string
  def parse_hsl(hsl_string)
    match = hsl_string.match(/hsl\((\d+), (\d+)%, (\d+)%\)/)
    return nil unless match

    {
      hue: match[1].to_i,
      saturation: match[2].to_i,
      lightness: match[3].to_i
    }
  end

  # Helper to convert HSL string back to hex for contrast checking
  def hsl_to_hex(hsl_string)
    parsed = parse_hsl(hsl_string)
    return nil unless parsed

    h = parsed[:hue]
    s = parsed[:saturation] / 100.0
    l = parsed[:lightness] / 100.0

    c = (1 - (2 * l - 1).abs) * s
    x = c * (1 - ((h / 60.0) % 2 - 1).abs)
    m = l - c / 2

    r, g, b = case h
    when 0...60 then [c, x, 0]
    when 60...120 then [x, c, 0]
    when 120...180 then [0, c, x]
    when 180...240 then [0, x, c]
    when 240...300 then [x, 0, c]
    else [c, 0, x]
    end

    r = ((r + m) * 255).round
    g = ((g + m) * 255).round
    b = ((b + m) * 255).round

    format("%02X%02X%02X", r, g, b)
  end

  describe ".create_semantic_variables" do
    # Standard shadcn/ui CSS variable names
    SHADCN_SURFACE_ROLES = %w[background primary secondary accent card popover muted destructive warning success].freeze
    SHADCN_UI_VARS = %w[border input ring].freeze

    context "shadcn/ui naming convention" do
      let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "generates --foreground (not --background-foreground)" do
        expect(result.keys).to include("--foreground")
        expect(result.keys).not_to include("--background-foreground")
      end

      it "generates --muted-foreground as global subdued text color" do
        expect(result.keys).to include("--muted-foreground")
        # Should NOT have --background-foreground-muted (old naming)
        expect(result.keys).not_to include("--background-foreground-muted")
      end

      it "generates all surface roles with their foregrounds" do
        SHADCN_SURFACE_ROLES.each do |role|
          expect(result.keys).to include("--#{role}"), "Missing --#{role}"
        end

        # background uses --foreground (not --background-foreground)
        # muted uses --muted-foreground (global subdued text)
        # all others have --{role}-foreground
        (SHADCN_SURFACE_ROLES - %w[background muted]).each do |role|
          expect(result.keys).to include("--#{role}-foreground"), "Missing --#{role}-foreground"
        end
      end

      it "does NOT generate *-foreground-muted variants (simplified API)" do
        result.keys.each do |key|
          expect(key).not_to end_with("-foreground-muted"), "Found deprecated #{key}"
        end
      end

      it "generates UI element variables" do
        SHADCN_UI_VARS.each do |var|
          expect(result.keys).to include("--#{var}"), "Missing --#{var}"
        end
      end

      it "generates HSL string values" do
        expect(result["--primary"]).to match(/hsl\(\d+, \d+%, \d+%\)/)
        expect(result["--background"]).to match(/hsl\(\d+, \d+%, \d+%\)/)
        expect(result["--foreground"]).to match(/hsl\(\d+, \d+%, \d+%\)/)
      end
    end

    context "WCAG AA contrast requirements (4.5:1 minimum)" do
      let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "ensures --foreground has AA contrast with --background" do
        bg_hex = hsl_to_hex(result["--background"])
        fg_hex = hsl_to_hex(result["--foreground"])

        ratio = WCAGColorContrast.ratio(bg_hex, fg_hex)
        expect(ratio).to be >= 4.5, "foreground/background contrast #{ratio}:1 < 4.5:1"
      end

      it "ensures --muted-foreground has AA contrast with --background" do
        bg_hex = hsl_to_hex(result["--background"])
        muted_fg_hex = hsl_to_hex(result["--muted-foreground"])

        ratio = WCAGColorContrast.ratio(bg_hex, muted_fg_hex)
        expect(ratio).to be >= 4.5, "muted-foreground/background contrast #{ratio}:1 < 4.5:1"
      end

      it "ensures --muted-foreground has AA contrast with --muted" do
        muted_hex = hsl_to_hex(result["--muted"])
        muted_fg_hex = hsl_to_hex(result["--muted-foreground"])

        ratio = WCAGColorContrast.ratio(muted_hex, muted_fg_hex)
        expect(ratio).to be >= 4.5, "muted-foreground/muted contrast #{ratio}:1 < 4.5:1"
      end

      it "ensures each role's foreground has AA contrast with its background" do
        # background uses --foreground, muted uses --muted-foreground
        # all others use --{role}-foreground
        (SHADCN_SURFACE_ROLES - %w[background muted]).each do |role|
          bg_hex = hsl_to_hex(result["--#{role}"])
          fg_hex = hsl_to_hex(result["--#{role}-foreground"])

          ratio = WCAGColorContrast.ratio(bg_hex, fg_hex)
          expect(ratio).to be >= 4.5, "--#{role}-foreground/--#{role} contrast #{ratio}:1 < 4.5:1"
        end
      end
    end

    context "with a dark palette" do
      let(:colors) { %w[1a1a2e 16213e 0f3460 1e2a3a 0d1821] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "uses light foreground colors for dark backgrounds" do
        fg = parse_hsl(result["--foreground"])
        expect(fg[:lightness]).to be >= 90, "Dark theme should have light foreground"
      end

      it "maintains AA contrast even with all-dark palette" do
        bg_hex = hsl_to_hex(result["--background"])
        fg_hex = hsl_to_hex(result["--foreground"])

        ratio = WCAGColorContrast.ratio(bg_hex, fg_hex)
        expect(ratio).to be >= 4.5
      end
    end

    context "with a light palette" do
      let(:colors) { %w[f8f9fa e9ecef dee2e6 ced4da adb5bd] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "uses dark foreground colors for light backgrounds" do
        fg = parse_hsl(result["--foreground"])
        expect(fg[:lightness]).to be <= 10, "Light theme should have dark foreground"
      end

      it "maintains AA contrast even with all-light palette" do
        bg_hex = hsl_to_hex(result["--background"])
        fg_hex = hsl_to_hex(result["--foreground"])

        ratio = WCAGColorContrast.ratio(bg_hex, fg_hex)
        expect(ratio).to be >= 4.5
      end
    end

    context "role assignment" do
      let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "assigns background to the lightest color" do
        bg = parse_hsl(result["--background"])
        expect(bg[:lightness]).to be > 50
      end

      it "assigns card and popover to match background" do
        expect(result["--card"]).to eq(result["--background"])
        expect(result["--popover"]).to eq(result["--background"])
      end

      it "assigns ring to match primary" do
        expect(result["--ring"]).to eq(result["--primary"])
      end

      it "assigns different colors to primary and secondary" do
        expect(result["--primary"]).not_to eq(result["--secondary"])
      end
    end

    context "status colors" do
      context "when palette contains status-colored hues" do
        let(:colors) { %w[264653 2A9D8F E9C46A dc3545 198754] }
        let(:result) { described_class.create_semantic_variables(colors) }

        it "uses palette red for destructive" do
          destructive = parse_hsl(result["--destructive"])
          # Red hue wraps around 0/360
          expect(destructive[:hue]).to satisfy { |h| h <= 15 || h >= 345 }
        end

        it "uses palette green for success" do
          success = parse_hsl(result["--success"])
          expect(success[:hue]).to be_between(100, 160)
        end
      end

      context "when palette lacks status colors" do
        let(:colors) { %w[1E3A5F 2E5077 3D6A8F 4A7FA8 5894C0] }
        let(:result) { described_class.create_semantic_variables(colors) }

        it "derives status colors with appropriate hues" do
          destructive = parse_hsl(result["--destructive"])
          warning = parse_hsl(result["--warning"])
          success = parse_hsl(result["--success"])

          expect(destructive[:hue]).to satisfy { |h| h <= 15 || h >= 345 }
          expect(warning[:hue]).to be_between(30, 60)
          expect(success[:hue]).to be_between(100, 160)
        end

        it "ensures derived status colors have AA contrast with their foregrounds" do
          %w[destructive warning success].each do |status|
            bg_hex = hsl_to_hex(result["--#{status}"])
            fg_hex = hsl_to_hex(result["--#{status}-foreground"])

            ratio = WCAGColorContrast.ratio(bg_hex, fg_hex)
            expect(ratio).to be >= 4.5, "--#{status}-foreground/--#{status} contrast #{ratio}:1 < 4.5:1"
          end
        end
      end
    end

    context "muted-foreground behavior" do
      let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
      let(:result) { described_class.create_semantic_variables(colors) }

      it "creates a subdued but readable text color" do
        muted_fg = parse_hsl(result["--muted-foreground"])
        parse_hsl(result["--foreground"])

        # Muted foreground should be less extreme than regular foreground
        # (closer to middle lightness, but still readable - 25-75% range)
        expect(muted_fg[:lightness]).to be_between(25, 75)
      end

      it "carries a hint of the theme's hue" do
        muted_fg = parse_hsl(result["--muted-foreground"])

        # Should have some saturation (not pure gray)
        expect(muted_fg[:saturation]).to be_between(1, 20)
      end
    end

    context "input normalization" do
      it "handles hash prefixes" do
        result = described_class.create_semantic_variables(%w[#264653 #2A9D8F #E9C46A])
        expect(result["--primary"]).to be_present
      end

      it "handles lowercase colors" do
        result = described_class.create_semantic_variables(%w[264653 2a9d8f e9c46a])
        expect(result["--primary"]).to be_present
      end

      it "returns empty hash for blank input" do
        expect(described_class.create_semantic_variables([])).to eq({})
        expect(described_class.create_semantic_variables(nil)).to eq({})
      end

      it "handles invalid colors gracefully" do
        expect { described_class.create_semantic_variables(%w[invalid]) }.not_to raise_error
      end
    end

    context "with fewer colors" do
      it "works with 2 colors" do
        result = described_class.create_semantic_variables(%w[264653 E9C46A])
        expect(result["--primary"]).to be_present
        expect(result["--background"]).to be_present
      end

      it "works with 1 color" do
        result = described_class.create_semantic_variables(%w[264653])
        expect(result["--primary"]).to be_present
      end
    end
  end

  describe ".compute_pairings" do
    context "with black and white" do
      let(:colors) { %w[FFFFFF 000000] }
      let(:result) { described_class.compute_pairings(colors) }

      it "returns pairings for each color plus standard foregrounds" do
        expect(result.keys).to include("FFFFFF", "000000", "FAFAFA", "0A0A0A")
      end

      it "computes 21:1 contrast for black/white" do
        white_pairs = result["FFFFFF"]
        black_pair = white_pairs.find { |p| p[:color] == "000000" }

        expect(black_pair[:contrast_ratio]).to eq(21.0)
        expect(black_pair[:level]).to eq("AAA")
      end
    end

    context "with a typical palette" do
      let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
      let(:result) { described_class.compute_pairings(colors) }

      it "only includes pairs meeting AA threshold (4.5:1)" do
        result.each do |_color, pairs|
          pairs.each do |pair|
            expect(pair[:contrast_ratio]).to be >= 4.5
          end
        end
      end

      it "sorts pairs by contrast ratio descending" do
        result.each do |_color, pairs|
          ratios = pairs.map { |p| p[:contrast_ratio] }
          expect(ratios).to eq(ratios.sort.reverse)
        end
      end

      it "includes contrast ratio and WCAG level for each pair" do
        result.each do |_color, pairs|
          pairs.each do |pair|
            expect(pair).to include(:color, :contrast_ratio, :level)
            expect(pair[:level]).to be_in(%w[AAA AA AA-large])
          end
        end
      end
    end

    context "WCAG level assignment" do
      let(:colors) { %w[FFFFFF 000000 808080] }
      let(:result) { described_class.compute_pairings(colors, min_contrast: 3.0) }

      it "assigns AAA for >= 7.0:1" do
        white_pairs = result["FFFFFF"]
        black_pair = white_pairs.find { |p| p[:color] == "000000" }
        expect(black_pair[:level]).to eq("AAA")
      end

      it "assigns AA for >= 4.5:1 but < 7.0:1" do
        # Gray has ~4.5:1 with white/black
        gray_pairs = result["808080"]
        high_contrast_pair = gray_pairs.find { |p| p[:contrast_ratio] >= 4.5 && p[:contrast_ratio] < 7.0 }
        expect(high_contrast_pair[:level]).to eq("AA") if high_contrast_pair
      end

      it "assigns AA-large for >= 3.0:1 but < 4.5:1" do
        result.each do |_color, pairs|
          pairs.each do |pair|
            if pair[:contrast_ratio] >= 3.0 && pair[:contrast_ratio] < 4.5
              expect(pair[:level]).to eq("AA-large")
            end
          end
        end
      end
    end

    context "custom minimum contrast" do
      let(:colors) { %w[FFFFFF 808080 000000] }

      it "filters out pairs below minimum" do
        strict = described_class.compute_pairings(colors, min_contrast: 7.0)
        lenient = described_class.compute_pairings(colors, min_contrast: 3.0)

        expect(lenient.values.flatten.count).to be > strict.values.flatten.count
      end
    end

    context "does not pair color with itself" do
      let(:result) { described_class.compute_pairings(%w[FFFFFF 000000]) }

      it "excludes self-pairings" do
        result.each do |color, pairs|
          expect(pairs.map { |p| p[:color] }).not_to include(color)
        end
      end
    end
  end
end
