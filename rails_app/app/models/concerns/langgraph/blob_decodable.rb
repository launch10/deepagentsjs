module Langgraph
  module BlobDecodable
    extend ActiveSupport::Concern

    def decoded_blob
      @decoded_blob ||= self.class.decode_blob(type, blob)
    end

    class_methods do
      def decode_blob(type_field, blob_data)
        case type_field
        when "json"
          return nil if blob_data.nil?
          JSON.parse(blob_data.force_encoding("UTF-8"))
        when "bytes"
          blob_data
        when "empty", nil
          nil
        end
      rescue JSON::ParserError => e
        Rails.logger.error("[Langgraph] JSON parse error: #{e.message}")
        nil
      end
    end
  end
end
