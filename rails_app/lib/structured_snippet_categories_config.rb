class StructuredSnippetCategoriesConfig
  class << self
    def definitions
      @definitions ||= JSON.parse(
        File.read(Rails.root.join("../shared/exports/structuredSnippetCategories.json"))
      ).transform_values(&:symbolize_keys)
    end

    def categories
      @categories ||= definitions.keys
    end
  end
end
