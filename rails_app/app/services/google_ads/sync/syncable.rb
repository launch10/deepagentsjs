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

          ignore_when = mapping[:ignore_when]
          should_ignore = ignore_when.respond_to?(:call) ? ignore_when.call : ignore_when
          next if should_ignore

          their_value = extract_remote_value(remote_resource, mapping)

          comparisons << FieldComparison.new(
            field: our_field,
            our_field: mapping[:our_field],
            our_value: our_value,
            their_field: mapping[:their_field],
            their_value: their_value,
            transform: mapping[:transform],
            their_value_transform: mapping[:their_value_transform]
          )
        end

        comparisons
      end

      private

      def extract_remote_value(remote, mapping)
        return nil unless remote

        their_field = mapping[:their_field]

        if mapping[:nested_fields] # multiple levels of nesting
          nested = remote
          mapping[:nested_fields].each do |nf|
            nested = nested.respond_to?(nf) ? nested.send(nf) : nil
            return nil unless nested
          end
          nested.respond_to?(their_field) ? nested.send(their_field) : nil
        elsif mapping[:nested_field] # single level of nesting
          nested = remote.respond_to?(mapping[:nested_field]) ? remote.send(mapping[:nested_field]) : nil
          nested&.respond_to?(their_field) ? nested.send(their_field) : nil
        else # no nesting
          remote.respond_to?(their_field) ? remote.send(their_field) : nil
        end
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
