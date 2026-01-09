module ThemeConcerns
  module TypographyRecommendations
    extend ActiveSupport::Concern

    # Standard foreground colors (reliable but less bold)
    STANDARD_LIGHT = "FAFAFA"
    STANDARD_DARK = "0A0A0A"

    class << self
      # Generate typography recommendations for each background color.
      # Returns structured guidance on which colors to use for headlines, body text, etc.
      #
      # @param colors [Array<String>] Palette colors (hex codes)
      # @param pairings [Hash] Computed pairings from SemanticVariables.compute_pairings
      # @return [Hash] Typography recommendations per background color
      #
      # @example Output structure:
      #   {
      #     "E9C46A" => {
      #       headlines: [
      #         { color: "264653", contrast: 12.5, level: "AAA", style: "bold" },
      #         { color: "0A0A0A", contrast: 15.2, level: "AAA", style: "clear" }
      #       ],
      #       subheadlines: [...],
      #       body: [...],
      #       accents: [...]
      #     }
      #   }
      def compute_recommendations(colors, pairings)
        return {} if colors.blank? || pairings.blank?

        normalized = normalize_colors(colors)
        recommendations = {}

        # Generate recommendations for each palette color as a potential background
        normalized.each do |bg_color|
          pairs = pairings[bg_color]
          next if pairs.blank?

          recommendations[bg_color] = {
            headlines: recommend_headlines(pairs, normalized),
            subheadlines: recommend_subheadlines(pairs, normalized),
            body: recommend_body(pairs, normalized),
            accents: recommend_accents(pairs, normalized)
          }
        end

        # Also include standard backgrounds (light/dark) if they have pairings
        [STANDARD_LIGHT, STANDARD_DARK].each do |std_bg|
          pairs = pairings[std_bg]
          next if pairs.blank?

          recommendations[std_bg] = {
            headlines: recommend_headlines(pairs, normalized),
            subheadlines: recommend_subheadlines(pairs, normalized),
            body: recommend_body(pairs, normalized),
            accents: recommend_accents(pairs, normalized)
          }
        end

        recommendations
      rescue => e
        Rails.logger.error("ThemeConcerns::TypographyRecommendations.compute_recommendations error: #{e.message}")
        {}
      end

      # Format recommendations as human-readable text for prompts
      #
      # @param recommendations [Hash] Output from compute_recommendations
      # @param colors [Array<String>] Original palette colors
      # @return [String] Formatted text for AI agent prompts
      def format_for_prompt(recommendations, colors)
        return "" if recommendations.blank?

        lines = ["Typography Guide:"]
        lines << "Palette: #{colors.map { |c| "##{c}" }.join(", ")}"
        lines << ""

        recommendations.each do |bg_color, recs|
          lines << "On ##{bg_color} background:"

          headlines = recs[:headlines] || recs["headlines"] || []
          if headlines.present?
            lines << "  Headlines (bold, attention-grabbing):"
            headlines.each do |rec|
              color = rec[:color] || rec["color"]
              contrast = rec[:contrast] || rec["contrast"]
              level = rec[:level] || rec["level"]
              style = rec[:style] || rec["style"]
              style_note = (style == "bold") ? "palette color" : "standard"
              lines << "    - ##{color} (#{contrast}:1 #{level}) [#{style_note}]"
            end
          end

          subheadlines = recs[:subheadlines] || recs["subheadlines"] || []
          if subheadlines.present?
            lines << "  Subheadlines (visual variety):"
            subheadlines.each do |rec|
              color = rec[:color] || rec["color"]
              contrast = rec[:contrast] || rec["contrast"]
              level = rec[:level] || rec["level"]
              lines << "    - ##{color} (#{contrast}:1 #{level})"
            end
          end

          body = recs[:body] || recs["body"] || []
          if body.present?
            lines << "  Body text (readable, clear):"
            body.first(2).each do |rec|
              color = rec[:color] || rec["color"]
              contrast = rec[:contrast] || rec["contrast"]
              level = rec[:level] || rec["level"]
              lines << "    - ##{color} (#{contrast}:1 #{level})"
            end
          end

          lines << ""
        end

        lines.join("\n")
      end

      private

      def normalize_colors(colors)
        colors.map { |c| c.to_s.delete("#").upcase }.reject(&:blank?)
      end

      # Headlines: AAA contrast preferred, palette colors first for boldness
      def recommend_headlines(pairs, palette_colors)
        results = []

        # First: AAA palette colors (bold and high contrast)
        palette_aaa = pairs.select do |p|
          get_level(p) == "AAA" && palette_colors.include?(get_color(p))
        end
        palette_aaa.each do |p|
          results << build_recommendation(p, "bold")
        end

        # Second: AAA standard colors (clear, reliable)
        standard_aaa = pairs.select do |p|
          get_level(p) == "AAA" && [STANDARD_LIGHT, STANDARD_DARK].include?(get_color(p))
        end
        standard_aaa.each do |p|
          results << build_recommendation(p, "clear")
        end

        # Third: AA palette colors if we need more options
        if results.count { |r| r[:style] == "bold" } < 2
          palette_aa = pairs.select do |p|
            get_level(p) == "AA" && palette_colors.include?(get_color(p))
          end
          palette_aa.first(2).each do |p|
            results << build_recommendation(p, "bold")
          end
        end

        results.uniq { |r| r[:color] }.first(5)
      end

      # Subheadlines: Can use AA-large (3:1) since they're typically 18pt+
      # Prioritize variety - different hues from headlines
      def recommend_subheadlines(pairs, palette_colors)
        results = []

        # AA and AA-large palette colors for visual variety
        palette_options = pairs.select do |p|
          %w[AAA AA AA-large].include?(get_level(p)) && palette_colors.include?(get_color(p))
        end

        palette_options.each do |p|
          min_size = (get_level(p) == "AA-large") ? "18pt+" : "any"
          results << build_recommendation(p, "palette", min_size)
        end

        results.uniq { |r| r[:color] }.first(4)
      end

      # Body text: Prioritize readability - AAA or strong AA, standard colors are great
      def recommend_body(pairs, palette_colors)
        results = []

        # Standard colors first (most readable)
        standard_options = pairs.select do |p|
          get_level(p) == "AAA" && [STANDARD_LIGHT, STANDARD_DARK].include?(get_color(p))
        end
        standard_options.each do |p|
          results << build_recommendation(p, "clear")
        end

        # High-contrast palette colors also work
        palette_aaa = pairs.select do |p|
          get_level(p) == "AAA" && palette_colors.include?(get_color(p))
        end
        palette_aaa.first(2).each do |p|
          results << build_recommendation(p, "palette")
        end

        results.uniq { |r| r[:color] }.first(3)
      end

      # Accents: Colors that can be used for highlights, even if lower contrast
      # Still need AA-large minimum for any text
      def recommend_accents(pairs, palette_colors)
        # All palette colors with at least AA-large compliance
        palette_accents = pairs.select do |p|
          %w[AAA AA AA-large].include?(get_level(p)) && palette_colors.include?(get_color(p))
        end

        palette_accents.map do |p|
          use = case get_level(p)
          when "AAA", "AA" then "text or decorative"
          when "AA-large" then "large text (18pt+) or decorative"
          else "decorative only"
          end
          build_recommendation(p, "accent", use)
        end.first(5)
      end

      # Helper methods to handle both symbol and string keys (JSONB returns strings)
      def get_color(pair)
        pair[:color] || pair["color"]
      end

      def get_level(pair)
        pair[:level] || pair["level"]
      end

      def get_contrast_ratio(pair)
        pair[:contrast_ratio] || pair["contrast_ratio"]
      end

      def build_recommendation(pair, style, note = nil)
        rec = {
          color: get_color(pair),
          contrast: get_contrast_ratio(pair),
          level: get_level(pair),
          style: style
        }
        rec[:note] = note if note
        rec
      end
    end
  end
end
