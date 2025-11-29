module DocumentConcerns
  module FrontmatterParsing
    extend ActiveSupport::Concern

    FRONTMATTER_REGEX = /\A---\s*\n(.*?)\n---\s*\n/m

    class_methods do
      def parse_frontmatter(raw_content)
        raw_content ||= ''
        match = raw_content.match(FRONTMATTER_REGEX)

        if match
          yaml_content = match[1]
          body_content = raw_content[match[0].length..]
          frontmatter = parse_yaml(yaml_content)
          { frontmatter: frontmatter, content: body_content.strip }
        else
          { frontmatter: {}, content: raw_content.strip }
        end
      end

      private

      def parse_yaml(yaml_string)
        parsed = YAML.safe_load(yaml_string, permitted_classes: [Symbol, Date, Time])
        parsed.is_a?(Hash) ? parsed.deep_symbolize_keys : {}
      rescue Psych::SyntaxError => e
        Rails.logger.warn("Failed to parse frontmatter YAML: #{e.message}")
        {}
      end
    end
  end
end
