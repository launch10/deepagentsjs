require "google/apis/drive_v3"
require "google/apis/docs_v1"
require "googleauth"

module GoogleDocs
  class Client
    include ActiveSupport::Configurable

    config_accessor :credentials_path

    SCOPES = [
      Google::Apis::DriveV3::AUTH_DRIVE_READONLY,
      Google::Apis::DocsV1::AUTH_DOCUMENTS_READONLY
    ].freeze

    attr_reader :drive_service, :docs_service

    def initialize(credentials_path: nil)
      @credentials_path = credentials_path || config.credentials_path
      authorize!
    end

    def list_files_in_folder(folder_id)
      files = []
      page_token = nil

      loop do
        response = drive_service.list_files(
          q: "'#{folder_id}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false",
          fields: "nextPageToken, files(id, name, modifiedTime)",
          page_token: page_token
        )

        files.concat(response.files || [])
        page_token = response.next_page_token
        break unless page_token
      end

      files
    end

    def find_folder_by_path(path, base_folder_id: "root")
      parts = path.split("/")
      parent_id = base_folder_id

      parts.each do |folder_name|
        folder = find_folder_in_parent(folder_name, parent_id)
        return nil unless folder
        parent_id = folder.id
      end

      parent_id
    end

    def get_document_content(doc_id)
      doc = docs_service.get_document(doc_id)
      extract_text_from_document(doc)
    end

    def get_document_metadata(doc_id)
      file = drive_service.get_file(doc_id, fields: "id, name, modifiedTime, createdTime, webViewLink")
      {
        id: file.id,
        name: file.name,
        modified_time: file.modified_time,
        created_time: file.created_time,
        web_view_link: file.web_view_link
      }
    end

    private

    def authorize!
      credentials = Google::Auth::ServiceAccountCredentials.make_creds(
        json_key_io: File.open(@credentials_path),
        scope: SCOPES
      )

      @drive_service = Google::Apis::DriveV3::DriveService.new
      @drive_service.authorization = credentials

      @docs_service = Google::Apis::DocsV1::DocsService.new
      @docs_service.authorization = credentials
    end

    def find_folder_in_parent(folder_name, parent_id)
      response = drive_service.list_files(
        q: "'#{parent_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '#{folder_name}' and trashed = false",
        fields: "files(id, name)"
      )
      response.files&.first
    end

    def extract_text_from_document(doc)
      return "" unless doc.body&.content

      text = ""
      doc.body.content.each do |element|
        text += extract_text_from_element(element)
      end
      text
    end

    def extract_text_from_element(element)
      return "" unless element

      if element.paragraph
        extract_text_from_paragraph(element.paragraph)
      elsif element.table
        extract_text_from_table(element.table)
      else
        ""
      end
    end

    def extract_text_from_paragraph(paragraph)
      return "" unless paragraph.elements

      text = ""
      paragraph.elements.each do |element|
        text += element.text_run.content if element.text_run
      end
      text
    end

    def extract_text_from_table(table)
      return "" unless table.table_rows

      text = ""
      table.table_rows.each do |row|
        row.table_cells&.each do |cell|
          cell.content&.each do |element|
            text += extract_text_from_element(element)
          end
        end
      end
      text
    end
  end
end
