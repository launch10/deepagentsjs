module GoogleDocs
  class SyncService
    FAQ_FOLDER_PATH = 'FAQs/Live'.freeze

    attr_reader :client, :langgraph_client

    def initialize(client: nil, langgraph_client: nil)
      @client = client || GoogleDocs::Client.new
      @langgraph_client = langgraph_client || LanggraphClient.new
    end

    def sync_all
      folder_id = client.find_folder_by_path(FAQ_FOLDER_PATH)
      raise "Folder not found: #{FAQ_FOLDER_PATH}" unless folder_id

      files = client.list_files_in_folder(folder_id)
      Rails.logger.info("[GoogleDocs::SyncService] Found #{files.count} documents in #{FAQ_FOLDER_PATH}")

      results = { synced: [], skipped: [], failed: [] }

      files.each do |file|
        result = sync_document(file)
        results[result[:status]] << result
      rescue => e
        Rails.logger.error("[GoogleDocs::SyncService] Error syncing #{file.name}: #{e.message}")
        results[:failed] << { file: file.name, error: e.message }
      end

      results
    end

    def sync_document(file)
      doc = Document.find_by(source_type: 'google_docs', source_id: file.id)

      if doc && doc.last_synced_at && doc.last_synced_at >= file.modified_time
        Rails.logger.info("[GoogleDocs::SyncService] Skipping #{file.name} - not modified")
        return { status: :skipped, file: file.name, reason: 'not_modified' }
      end

      content = client.get_document_content(file.id)
      metadata = client.get_document_metadata(file.id)

      doc = Document.find_or_create_from_external!(content,
        source_type: 'google_docs',
        source_id: file.id,
        slug: generate_slug(file.name),
        title: file.name,
        source_url: metadata[:web_view_link],
        metadata: {
          google_modified_time: metadata[:modified_time],
          google_created_time: metadata[:created_time]
        }
      )

      extract_and_sync_chunks(doc)

      Rails.logger.info("[GoogleDocs::SyncService] Synced #{file.name}")
      { status: :synced, file: file.name, document_id: doc.id }
    end

    private

    def extract_and_sync_chunks(doc)
      return if doc.content.blank?

      response = langgraph_client.extract_qa(
        content: doc.content,
        metadata: { title: doc.title }
      )

      pairs = response.pairs.map do |pair|
        {
          question: pair.question,
          answer: pair.answer,
          section: pair.section
        }
      end

      doc.sync_chunks(pairs)
    end

    def generate_slug(name)
      name.parameterize.underscore
    end
  end
end
