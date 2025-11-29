module GoogleDocs
  class SyncService
    # Ensure you share access to any Google Drive folder you need to sync
    # with the service account: launch10@launch10-479317.iam.gserviceaccount.com
    # as a VIEWER
    FOLDER_PATHS = {
      'FAQs' => "1F7svsAd9l-Fqt9KtjqrAgRnHXDGZc1WL" # Pull from https://drive.google.com/drive/u/1/folders/1F6pUGR272yRysjuO03OXIib0IZT8ZgiI
    }

    attr_reader :client, :langgraph_client

    def initialize(langgraph_client: nil)
      @client = GoogleDocs::Client.new
      @langgraph_client = LanggraphClient.new
    end

    def sync_all
      files = client.list_files_in_folder(FOLDER_PATHS['FAQs'])
      Rails.logger.info("[GoogleDocs::SyncService] Found #{files.count} documents in FAQs")

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
        document_type: "faq",
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
      binding.pry

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
