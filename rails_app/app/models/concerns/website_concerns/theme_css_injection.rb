module WebsiteConcerns
  module ThemeCssInjection
    extend ActiveSupport::Concern

    INDEX_CSS_PATH = "src/index.css"

    # Regex to match the :root { ... } block in CSS
    ROOT_BLOCK_REGEX = /(:root\s*\{)[^}]*(\})/m

    included do
      after_save :inject_theme_css!, if: :should_inject_theme_css?
    end

    # Inject theme CSS variables into the website's index.css file
    # Surgically replaces just the :root { ... } block, preserving everything else
    def inject_theme_css!
      return unless theme&.theme.present?

      css_file = website_files.find_by(path: INDEX_CSS_PATH)
      if css_file&.content.nil?
        template_css = template_files.find_by(path: INDEX_CSS_PATH)
        return unless template_css&.content.present?

        css_file = website_files.create!(path: INDEX_CSS_PATH, content: template_css.content)
      end

      css_file.content = replace_root_block(css_file.content, theme.theme)
      css_file.save!
    end

    def has_index_css?
      website_files.exists?(path: INDEX_CSS_PATH)
    end

    private

    def should_inject_theme_css?
      saved_change_to_theme_id? && theme.present? || (!has_index_css? && theme.present?)
    end

    # Replace the :root { ... } block in CSS content with new theme variables
    # @param css_content [String] the existing CSS content
    # @param css_vars [Hash] hash of CSS variable names to raw HSL values
    # @return [String] the updated CSS content
    def replace_root_block(css_content, css_vars)
      new_root_content = generate_root_content(css_vars)

      css_content.gsub(ROOT_BLOCK_REGEX) do
        ":root {\n#{new_root_content}  }"
      end
    end

    # Generate the content inside :root { ... }
    # @param css_vars [Hash] hash of CSS variable names to values
    # @return [String] formatted CSS variable declarations
    def generate_root_content(css_vars)
      lines = []

      css_vars.each do |name, value|
        lines << "    #{name}: #{value};"
      end

      lines.join("\n") + "\n"
    end
  end
end
