module ThemeConcerns
  module IndexCssGeneration
    extend ActiveSupport::Concern

    included do
      after_save :regenerate_and_propagate_css, if: :should_regenerate_css?
    end

    # Generate the index.css content from this theme's CSS variables
    # @return [String, nil] the CSS content or nil if no theme variables
    def generate_index_css
      return nil unless theme.present?

      css_vars = theme
      root_vars = self.class.generate_root_variables(css_vars)

      <<~CSS
        @tailwind base;
        @tailwind components;
        @tailwind utilities;

        @layer base {
          :root {
        #{root_vars}
          }
        }

        @layer base {
          * {
            @apply border-border;
          }

          body {
            @apply bg-background text-foreground;
            font-feature-settings: "rlig" 1, "calt" 1;
          }
        }
      CSS
    end

    class_methods do
      # Generate CSS variable declarations from theme hash
      # @param css_vars [Hash] hash of CSS variable names to values
      # @return [String] formatted CSS variable declarations
      def generate_root_variables(css_vars)
        grouped = group_css_variables(css_vars)

        lines = []
        lines << format_variable_group(grouped[:background], "/* Background */")
        lines << format_variable_group(grouped[:primary], "/* Primary */")
        lines << format_variable_group(grouped[:secondary], "/* Secondary */")
        lines << format_variable_group(grouped[:neutral], "/* Neutral */")
        lines << format_variable_group(grouped[:ui], "/* UI Elements */")
        lines << format_variable_group(grouped[:state], "/* State Colors */")

        lines.compact.join("\n")
      end

      private

      def group_css_variables(css_vars)
        {
          background: css_vars.select { |k, _| k.to_s.start_with?("--background", "--foreground") },
          primary: css_vars.select { |k, _| k.to_s.start_with?("--primary") },
          secondary: css_vars.select { |k, _| k.to_s.start_with?("--secondary") },
          neutral: css_vars.select { |k, _| k.to_s.start_with?("--neutral") },
          ui: css_vars.select { |k, _| k.to_s =~ /^--(card|popover|muted|accent|input|border|ring)/ },
          state: css_vars.select { |k, _| k.to_s =~ /^--(success|warning|destructive)/ }
        }
      end

      def format_variable_group(vars, comment)
        return nil if vars.empty?

        lines = ["    #{comment}"]
        vars.each do |name, value|
          lines << "    #{name}: #{value};"
        end
        lines.join("\n")
      end
    end

    private

    def should_regenerate_css?
      (saved_change_to_theme? && theme.present?) || index_css_content.blank?
    end

    # Regenerate CSS content and propagate to all associated websites
    def regenerate_and_propagate_css
      new_css = generate_index_css
      update_column(:index_css_content, new_css)

      # Update all websites using this theme
      Website.where(theme_id: id).find_each do |website|
        website.inject_theme_css!
      end
    end
  end
end
