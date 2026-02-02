module Madmin
  class DocumentsController < Madmin::ApplicationController
    def index
      @documents = ::Document.includes(:chunks).order(updated_at: :desc)

      render inertia: "Madmin/Documents/Index",
        props: {
          documents: @documents.map { |d| serialize_document(d) },
          syncPath: "/admin/documents/sync"
        }
    end

    def show
      @document = ::Document.find(params[:id])

      render inertia: "Madmin/Documents/Show",
        props: {
          document: serialize_document(@document, detailed: true),
          resyncPath: "/admin/documents/#{@document.id}/resync"
        }
    end

    def sync
      force = params[:force] == "true" || params[:force] == true
      service = GoogleDocs::SyncService.new
      results = service.sync_all(force: force)

      redirect_to madmin_documents_path, notice: sync_notice(results)
    end

    def resync
      @document = ::Document.find(params[:id])

      service = GoogleDocs::SyncService.new
      file = OpenStruct.new(
        id: @document.source_id,
        name: @document.title,
        modified_time: Time.current
      )

      result = service.sync_document(file, force: true)

      if result[:status] == :queued
        redirect_to madmin_document_path(@document), notice: "Extraction queued for #{@document.title}"
      else
        redirect_to madmin_document_path(@document), alert: "Failed to sync: #{result[:error] || result[:reason]}"
      end
    end

    private

    def serialize_document(document, detailed: false)
      data = {
        id: document.id,
        title: document.title,
        slug: document.slug,
        status: document.status,
        documentType: document.document_type,
        sourceType: document.source_type,
        sourceUrl: document.source_url,
        chunksCount: document.chunks.size,
        lastSyncedAt: document.last_synced_at&.iso8601,
        createdAt: document.created_at&.iso8601,
        updatedAt: document.updated_at&.iso8601
      }

      if detailed
        data.merge!(
          content: document.content&.truncate(500),
          metadata: document.metadata,
          tags: document.tags,
          chunks: document.chunks.order(:position).map do |chunk|
            {
              id: chunk.id,
              question: chunk.question,
              answer: chunk.answer&.truncate(200),
              section: chunk.section,
              position: chunk.position
            }
          end
        )
      end

      data
    end

    def sync_notice(results)
      parts = []
      parts << "#{results[:queued].size} queued" if results[:queued].any?
      parts << "#{results[:skipped].size} skipped" if results[:skipped].any?
      parts << "#{results[:failed].size} failed" if results[:failed].any?
      "Sync complete: #{parts.join(", ")}"
    end
  end
end
