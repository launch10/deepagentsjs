module ThemeConcerns
  module SemanticVariables
    extend ActiveSupport::Concern

    LIGHT_FOREGROUND = "FAFAFA"
    DARK_FOREGROUND = "0A0A0A"

    # WCAG contrast thresholds
    WCAG_AA_NORMAL_TEXT = 4.5   # Normal text (< 18pt or < 14pt bold)
    WCAG_AA_LARGE_TEXT = 3.0    # Large text (>= 18pt or >= 14pt bold)
    WCAG_AAA_NORMAL_TEXT = 7.0  # Enhanced contrast for normal text
    WCAG_AAA_LARGE_TEXT = 4.5   # Enhanced contrast for large text

    # Default status colors (Bootstrap-inspired)
    DEFAULTS = {
      destructive: "dc3545",
      warning: "ffc107",
      success: "198754"
    }.freeze

    class << self
      # Compute accessible color pairings with WCAG contrast ratios.
      # Returns a hash where each color maps to its accessible pairs.
      #
      # @param colors [Array<String>] Array of hex color codes
      # @param min_contrast [Float] Minimum contrast ratio (default: WCAG AA 4.5:1)
      # @return [Hash] Pairings hash, e.g. { "FFFFFF" => [{ color: "000000", contrast_ratio: 21.0, level: "AAA" }] }
      #
      # @example
      #   compute_pairings(%w[FFFFFF 000000 264653])
      #   # => {
      #   #   "FFFFFF" => [{ color: "000000", contrast_ratio: 21.0, level: "AAA" }, ...],
      #   #   "000000" => [{ color: "FFFFFF", contrast_ratio: 21.0, level: "AAA" }, ...],
      #   #   ...
      #   # }
      def compute_pairings(colors, min_contrast: WCAG_AA_NORMAL_TEXT)
        return {} if colors.blank?

        normalized = normalize_colors(colors)
        return {} if normalized.empty?

        # Add standard foreground colors for completeness
        all_colors = (normalized + [LIGHT_FOREGROUND, DARK_FOREGROUND]).uniq

        pairings = {}

        all_colors.each do |color|
          accessible_pairs = []

          all_colors.each do |other_color|
            next if color == other_color

            ratio = contrast_ratio(color, other_color)
            next if ratio < min_contrast

            accessible_pairs << {
              color: other_color,
              contrast_ratio: ratio.round(2),
              level: wcag_level(ratio)
            }
          end

          # Sort by contrast ratio descending (best contrast first)
          pairings[color] = accessible_pairs.sort_by { |p| -p[:contrast_ratio] }
        end

        pairings
      rescue StandardError => e
        Rails.logger.error("ThemeConcerns::SemanticVariables.compute_pairings error: #{e.message}")
        {}
      end

      def create_semantic_variables(colors)
        return {} if colors.blank?

        normalized = normalize_colors(colors)
        return {} if normalized.empty?

        roles = assign_roles(normalized)
        generate_variables(roles)
      rescue StandardError => e
        Rails.logger.error("Themes::ColorExpander error: #{e.message}")
        {}
      end

      private

      # === Color Normalization ===

      def normalize_colors(colors)
        colors.map { |c| c.to_s.delete("#").upcase }.reject(&:blank?)
      end

      # === Role Assignment ===
      # Assigns semantic roles based on color properties:
      # - Background: highest luminance (lightest)
      # - Primary: most saturated with good contrast against background
      # - Secondary: second most saturated, different hue from primary
      # - Accent: third option, or derived from primary
      # - Muted: lowest saturation (most neutral)

      def assign_roles(colors)
        analyzed = colors.map { |hex| analyze_color(hex) }.compact
        return {} if analyzed.empty?

        sorted_by_luminance = analyzed.sort_by { |c| -c[:luminance] }
        sorted_by_saturation = analyzed.sort_by { |c| -c[:saturation] }

        background = sorted_by_luminance.first
        primary = select_primary(sorted_by_saturation, background)
        secondary = select_secondary(analyzed, primary, background)
        accent = select_accent(analyzed, primary, secondary, background)
        muted = sorted_by_saturation.last

        {
          background: background[:hex],
          primary: primary[:hex],
          secondary: secondary[:hex],
          accent: accent[:hex],
          muted: muted[:hex],
          card: background[:hex],
          popover: background[:hex],
          destructive: find_by_hue(analyzed, 345..15) || DEFAULTS[:destructive],
          warning: find_by_hue(analyzed, 35..55) || DEFAULTS[:warning],
          success: find_by_hue(analyzed, 100..160) || DEFAULTS[:success]
        }
      end

      def analyze_color(hex)
        color = Chroma.paint("##{hex}")
        {
          hex: hex,
          luminance: WCAGColorContrast.relative_luminance(hex),
          saturation: color.hsl.s,
          hue: color.hsl.h
        }
      rescue StandardError
        nil
      end

      def select_primary(by_saturation, background)
        # Most saturated that has good contrast with background
        by_saturation.find { |c| contrast_ratio(c[:hex], background[:hex]) >= 3.0 } || by_saturation.first
      end

      def select_secondary(colors, primary, background)
        # Different hue from primary, good contrast with background
        candidates = colors.reject { |c| c[:hex] == primary[:hex] || c[:hex] == background[:hex] }
        candidates.find { |c| hue_distance(c[:hue], primary[:hue]) > 30 } || candidates.first || primary
      end

      def select_accent(colors, primary, secondary, background)
        used = [primary[:hex], secondary[:hex], background[:hex]]
        candidates = colors.reject { |c| used.include?(c[:hex]) }
        candidates.first || secondary
      end

      def find_by_hue(colors, range)
        colors.find { |c| hue_in_range?(c[:hue], range) }&.dig(:hex)
      end

      def hue_in_range?(hue, range)
        if range.first > range.last # Wraps around (e.g., 345..15 for reds)
          hue >= range.first || hue <= range.last
        else
          range.cover?(hue)
        end
      end

      def hue_distance(h1, h2)
        diff = (h1 - h2).abs
        [diff, 360 - diff].min
      end

      def contrast_ratio(hex1, hex2)
        WCAGColorContrast.ratio(hex1, hex2)
      end

      def wcag_level(ratio)
        if ratio >= WCAG_AAA_NORMAL_TEXT
          "AAA"
        elsif ratio >= WCAG_AA_NORMAL_TEXT
          "AA"
        elsif ratio >= WCAG_AA_LARGE_TEXT
          "AA-large"
        else
          "fail"
        end
      end

      # === Variable Generation ===

      def generate_variables(roles)
        vars = {}

        # Background and foreground
        vars["--background"] = to_hsl(roles[:background])
        vars["--background-foreground"] = contrasting_foreground(roles[:background])
        vars["--background-foreground-muted"] = muted_foreground(roles[:background])

        # Semantic roles
        %i[primary secondary accent muted card popover destructive warning success].each do |role|
          hex = roles[role]
          vars["--#{role}"] = to_hsl(hex)
          vars["--#{role}-foreground"] = contrasting_foreground(hex)
          vars["--#{role}-foreground-muted"] = muted_foreground(hex)
        end

        # UI elements
        vars["--border"] = derive_border(roles[:background])
        vars["--input"] = vars["--border"]
        vars["--ring"] = vars["--primary"]

        # Neutrals
        vars["--neutral-1"] = "hsl(210, 6%, 94%)"
        vars["--neutral-2"] = "hsl(210, 4%, 89%)"
        vars["--neutral-3"] = "hsl(210, 3%, 85%)"

        vars
      end

      def contrasting_foreground(hex)
        luminance = WCAGColorContrast.relative_luminance(hex)
        fg = luminance > 0.179 ? DARK_FOREGROUND : LIGHT_FOREGROUND
        to_hsl(fg)
      end

      def muted_foreground(hex)
        # Blend foreground toward background for softer contrast
        luminance = WCAGColorContrast.relative_luminance(hex)
        if luminance > 0.179
          # Dark foreground on light background - make it lighter (gray)
          "hsl(0, 0%, 27%)"
        else
          # Light foreground on dark background - make it darker (light gray)
          "hsl(0, 0%, 75%)"
        end
      end

      def derive_border(background_hex)
        luminance = WCAGColorContrast.relative_luminance(background_hex)
        if luminance > 0.5
          "hsl(210, 9%, 96%)"
        else
          "hsl(210, 9%, 20%)"
        end
      end

      def to_hsl(hex)
        color = Chroma.paint("##{hex}")
        hsl = color.hsl
        "hsl(#{hsl.h.round}, #{(hsl.s * 100).round}%, #{(hsl.l * 100).round}%)"
      rescue StandardError
        "hsl(0, 0%, 50%)"
      end
    end
  end
end
