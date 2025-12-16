module AdStructuredSnippetConcerns
  module Categories
    extend ActiveSupport::Concern

    included do
      validates :category, presence: true, inclusion: { in: ->(_) { StructuredSnippetCategoriesConfig.categories } }
    end

    class_methods do
      def category_definitions
        StructuredSnippetCategoriesConfig.definitions
      end

      def categories
        StructuredSnippetCategoriesConfig.categories
      end
    end
  end
end
