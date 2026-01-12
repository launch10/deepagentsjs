module WebsiteConcerns
  module ThemeCssInjection
    extend ActiveSupport::Concern

    INDEX_CSS_PATH = "src/index.css"

    included do
      after_save :inject_theme_css!, if: :should_inject_theme_css?
    end

    # Inject theme CSS into the website's index.css file
    # Called when theme_id changes or when theme's colors are updated
    def inject_theme_css!
      return unless theme&.index_css_content.present?

      css_file = website_files.find_or_initialize_by(path: INDEX_CSS_PATH)
      css_file.content = theme.index_css_content
      css_file.save!
    end

    private

    def should_inject_theme_css?
      saved_change_to_theme_id? && theme.present?
    end
  end
end
