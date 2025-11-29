module DocumentConcerns
  module SyncableDocument
    extend ActiveSupport::Concern

    class_methods do
      def find_or_create_from_external!(raw_content, source_type:, source_id:, **overrides)
        parsed = parse_frontmatter(raw_content)
        fm = parsed[:frontmatter]

        doc = find_by(source_type: source_type, source_id: source_id)

        attrs = {
          slug: fm[:slug] || overrides[:slug],
          title: fm[:title] || overrides[:title],
          content: parsed[:content],
          status: fm[:status] || overrides[:status] || 'live',
          document_type: fm[:type] || fm[:document_type] || overrides[:document_type] || 'qa',
          tags: fm[:tags] || overrides[:tags] || [],
          source_type: source_type,
          source_id: source_id,
          source_url: overrides[:source_url],
          metadata: (doc&.metadata || {}).merge(fm[:metadata] || {}).merge(overrides[:metadata] || {}),
          last_synced_at: overrides[:last_synced_at] || Time.current
        }

        if doc
          doc.update!(attrs)
          doc
        else
          create!(attrs)
        end
      end
    end
  end
end
