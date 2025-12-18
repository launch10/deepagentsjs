module GoogleAds
  module Sync
    class Syncable
      extend Memoist
      include TypeCheck

      attr_reader :local_resource

      def initialize(local_resource)
        @local_resource = local_resource
      end

      def client
        GoogleAds.client
      end

      def synced?
        sync_result.synced?
      end
      memoize :synced?

      def sync
        raise "Not implemented error"
      end

      def delete
        raise "Not implemented error"
      end

      def sync_result
        raise "Not implemented error"
      end
      memoize :sync_result

      def fetch_remote
        raise "Not implemented error"
      end

      def remote_resource
        fetch_remote
      end
      memoize :remote_resource

      def build_comparisons
        return [] unless local_resource && remote_resource

        field_mappings = FieldMappings.for(local_resource.class)
        comparisons = []

        field_mappings.each do |_key, mapping|
          our_field = mapping[:our_field]
          our_value = local_resource.respond_to?(our_field) ? local_resource.send(our_field) : nil
          next if our_value.nil?

          their_value = extract_remote_value(remote_resource, mapping[:their_field])

          comparisons << FieldComparison.new(
            field: our_field,
            our_field: mapping[:our_field],
            our_value: our_value,
            their_field: mapping[:their_field],
            their_value: their_value,
            transform: mapping[:transform]
          )
        end

        comparisons
      end

      private

      def extract_remote_value(remote, field)
        return nil unless remote
        remote.respond_to?(field) ? remote.send(field) : nil
      end

      def not_found_result(resource_type)
        expect_type(resource_type, Symbol)

        SyncResult.new(
          resource_type: resource_type,
          action: :not_found,
          comparisons: []
        )
      end

      def error_result(resource_type, error)
        expect_type(resource_type, Symbol)
        expect_type(error, StandardError)

        SyncResult.new(
          resource_type: resource_type,
          action: :error,
          comparisons: [],
          error: error
        )
      end
    end
  end
end
