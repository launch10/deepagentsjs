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

    # Target hues for status colors
    STATUS_HUES = {
      destructive: 0,    # Red
      warning: 45,       # Orange/yellow
      success: 140       # Green
    }.freeze

    # Guardrails for derived status colors to feel "colorful"
    # Lightness bounds ensure 4.5:1+ contrast with black/white foreground
    MIN_STATUS_SATURATION = 0.45
    MIN_STATUS_LIGHTNESS = 0.30  # Dark enough for light foreground contrast
    MAX_STATUS_LIGHTNESS = 0.50  # Light enough for dark foreground contrast

    # Tinting configuration for on-theme muted and border colors
    MUTED_FOREGROUND_SATURATION = 10  # Subtle but visible tint
    MUTED_LIGHT_BG_LIGHTNESS = 27     # Dark text on light backgrounds
    MUTED_DARK_BG_LIGHTNESS = 75      # Light text on dark backgrounds
    BORDER_MAX_SATURATION = 12        # Keep borders subtle

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
      rescue => e
        Rails.logger.error("ThemeConcerns::SemanticVariables.compute_pairings error: #{e.message}")
        {}
      end

      def create_semantic_variables(colors)
        return {} if colors.blank?

        normalized = normalize_colors(colors)
        return {} if normalized.empty?

        roles = assign_roles(normalized)
        generate_variables(roles)
      rescue => e
        Rails.logger.error("ThemeConcerns::SemanticVariables.create_semantic_variables error: #{e.message}")
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
      # - Muted: derived from background (tonally similar per shadcn convention)

      def assign_roles(colors)
        analyzed = colors.map { |hex| analyze_color(hex) }.compact
        return {} if analyzed.empty?

        sorted_by_luminance = analyzed.sort_by { |c| -c[:luminance] }
        sorted_by_saturation = analyzed.sort_by { |c| -c[:saturation] }

        background = sorted_by_luminance.first
        primary = select_primary(sorted_by_saturation, background)
        secondary = select_secondary(analyzed, primary, background)
        accent = select_accent(analyzed, primary, secondary, background)
        # Muted should be tonally similar to background (shadcn convention)
        muted = derive_muted_from_background(background)

        {
          background: background[:hex],
          primary: primary[:hex],
          secondary: secondary[:hex],
          accent: accent[:hex],
          muted: muted,
          card: background[:hex],
          popover: background[:hex],
          destructive: find_by_hue(analyzed, 345..15) || derive_status_color(primary, :destructive),
          warning: find_by_hue(analyzed, 35..55) || derive_status_color(primary, :warning),
          success: find_by_hue(analyzed, 100..160) || derive_status_color(primary, :success)
        }
      end

      # Derive a status color using the theme's primary color characteristics
      # This creates status colors that "feel" like part of the theme
      def derive_status_color(primary, status_type)
        target_hue = STATUS_HUES[status_type]
        primary_color = Chroma.paint("##{primary[:hex]}")

        # Use primary's saturation and lightness as baseline, with guardrails
        saturation = [primary_color.hsl.s, MIN_STATUS_SATURATION].max
        initial_lightness = primary_color.hsl.l.clamp(MIN_STATUS_LIGHTNESS, MAX_STATUS_LIGHTNESS)

        # Ensure derived color has 4.5:1+ contrast with its foreground
        # Avoid the "middle zone" (45-55%) where neither foreground has great contrast
        lightness = if initial_lightness > 0.45 && initial_lightness < 0.55
                      # Push to darker side for better contrast with light foreground
                      0.42
                    else
                      initial_lightness
                    end

        derived = Chroma.paint("hsl(#{target_hue}, #{saturation * 100}%, #{lightness * 100}%)")
        derived.to_hex.delete("#").upcase
      rescue
        # Fallback to a reasonable default if derivation fails
        case status_type
        when :destructive then "DC3545"
        when :warning then "FFC107"
        when :success then "198754"
        end
      end

      def analyze_color(hex)
        color = Chroma.paint("##{hex}")
        {
          hex: hex,
          luminance: WCAGColorContrast.relative_luminance(hex),
          saturation: color.hsl.s,
          hue: color.hsl.h
        }
      rescue
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

      # Derive muted from background (shadcn convention: muted is tonally similar to background)
      # Light backgrounds get a slightly darker/grayer muted; dark backgrounds get slightly lighter
      def derive_muted_from_background(background)
        bg_color = Chroma.paint("##{background[:hex]}")
        bg_lightness = bg_color.hsl.l
        bg_hue = bg_color.hsl.h
        bg_saturation = bg_color.hsl.s

        if bg_lightness > 0.5
          # Light background: muted is slightly darker and desaturated
          # Similar to shadcn's 240 4.8% 95.9% for light theme muted
          muted_lightness = [bg_lightness - 0.05, 0.90].max
          muted_saturation = [bg_saturation * 0.3, 0.05].max
        else
          # Dark background: muted is slightly lighter and desaturated
          # Similar to shadcn's 217.2 32.6% 17.5% for dark theme muted
          muted_lightness = [bg_lightness + 0.08, 0.25].min
          muted_saturation = [bg_saturation * 0.5, 0.15].max
        end

        muted_color = Chroma.paint("hsl(#{bg_hue}, #{muted_saturation * 100}%, #{muted_lightness * 100}%)")
        muted_color.to_hex.delete("#").upcase
      rescue
        background[:hex] # Fallback to background itself
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
      # Generates CSS variables following shadcn/ui naming conventions:
      # - --background / --foreground (main page)
      # - --muted-foreground (subdued text, works on background AND muted)
      # - --{role} / --{role}-foreground for each semantic role

      def generate_variables(roles)
        vars = {}
        primary_hue = extract_hue(roles[:primary])
        background_hue = extract_hue(roles[:background])

        # Background and foreground (shadcn convention: --foreground, not --background-foreground)
        vars["--background"] = to_hsl(roles[:background])
        vars["--foreground"] = contrasting_foreground(roles[:background])

        # Muted foreground - subdued text that works on BOTH --background AND --muted
        # This is the shadcn convention: --muted-foreground is a global subdued text color
        vars["--muted-foreground"] = muted_foreground_color(roles[:background], roles[:muted], primary_hue)

        # Semantic surface roles - each has bg + fg
        %i[primary secondary accent card popover destructive warning success].each do |role|
          hex = roles[role]
          vars["--#{role}"] = to_hsl(hex)
          vars["--#{role}-foreground"] = contrasting_foreground(hex)
        end

        # Muted surface (background uses --muted-foreground for text per shadcn)
        vars["--muted"] = to_hsl(roles[:muted])

        # UI elements - tinted with background's hue
        vars["--border"] = derive_tinted_border(roles[:background], background_hue)
        vars["--input"] = vars["--border"]
        vars["--ring"] = vars["--primary"]

        vars
      end

      # Create a muted foreground that has sufficient contrast with --background.
      # Per shadcn convention, --muted-foreground is subdued text used on background surfaces.
      # We prioritize contrast with --background since that's the primary use case.
      def muted_foreground_color(background_hex, _muted_hex, primary_hue)
        bg_luminance = WCAGColorContrast.relative_luminance(background_hex)

        # Create muted foreground with AA contrast against background
        # Light backgrounds get dark muted text, dark backgrounds get light muted text
        if bg_luminance > 0.179
          # Light background: use dark-ish gray (28% lightness gives ~5:1 on light backgrounds)
          "hsl(#{primary_hue}, 5%, 28%)"
        else
          # Dark background: use light-ish gray (75% lightness gives ~5:1 on dark backgrounds)
          "hsl(#{primary_hue}, 5%, 75%)"
        end
      end

      def extract_hue(hex)
        color = Chroma.paint("##{hex}")
        color.hsl.h.round
      rescue
        210 # Fallback to a neutral blue-gray
      end

      def contrasting_foreground(hex)
        luminance = WCAGColorContrast.relative_luminance(hex)
        fg = (luminance > 0.179) ? DARK_FOREGROUND : LIGHT_FOREGROUND
        to_hsl(fg)
      end

      # Create a muted foreground color that carries a hint of the theme's primary hue.
      # This ensures muted text feels "on theme" rather than using generic gray.
      def tinted_muted_foreground(background_hex, primary_hue)
        luminance = WCAGColorContrast.relative_luminance(background_hex)
        lightness = (luminance > 0.179) ? MUTED_LIGHT_BG_LIGHTNESS : MUTED_DARK_BG_LIGHTNESS

        "hsl(#{primary_hue}, #{MUTED_FOREGROUND_SATURATION}%, #{lightness}%)"
      end

      # Create a border color that carries a hint of the background's hue.
      # This ensures UI elements feel cohesive with the overall theme.
      def derive_tinted_border(background_hex, background_hue)
        luminance = WCAGColorContrast.relative_luminance(background_hex)
        bg_color = Chroma.paint("##{background_hex}")

        # Derive saturation from background, capped to stay subtle
        saturation = [(bg_color.hsl.s * 15).round, 6].max.clamp(1, BORDER_MAX_SATURATION)
        lightness = (luminance > 0.5) ? 96 : 20

        "hsl(#{background_hue}, #{saturation}%, #{lightness}%)"
      rescue
        # Fallback to neutral gray
        (luminance > 0.5) ? "hsl(210, 9%, 96%)" : "hsl(210, 9%, 20%)"
      end

      def to_hsl(hex)
        color = Chroma.paint("##{hex}")
        hsl = color.hsl
        "hsl(#{hsl.h.round}, #{(hsl.s * 100).round}%, #{(hsl.l * 100).round}%)"
      rescue
        "hsl(0, 0%, 50%)"
      end
    end
  end
end
