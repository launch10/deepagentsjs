module GoogleAds
  module Resources
    module FieldMappable
      extend ActiveSupport::Concern

      class_methods do
        def field_mapping(name, local:, remote:, transform: nil, reverse_transform: nil, immutable: false, skip_comparison: false)
          field_mappings[name] = {
            local: local,
            remote: remote,
            transform: transform,
            reverse_transform: reverse_transform,
            immutable: immutable,
            skip_comparison: skip_comparison
          }
        end

        def field_mappings
          @field_mappings ||= {}
        end

        # Get list of immutable fields
        def immutable_fields
          field_mappings.select { |_, m| m[:immutable] }.keys
        end

        # Get list of mutable fields
        def mutable_fields
          field_mappings.reject { |_, m| m[:immutable] }.keys
        end
      end

      # Extract local value using symbol or lambda
      def local_value(name)
        mapping = self.class.field_mappings[name]
        raise ArgumentError, "Unknown field mapping: #{name}" unless mapping

        extractor = mapping[:local]

        raw = if extractor.is_a?(Symbol)
          record.send(extractor)
        else
          extractor.call(record)
        end

        # Apply transform if present
        if mapping[:transform] && !raw.nil?
          apply_transform(mapping[:transform], raw)
        else
          raw
        end
      end

      # Extract remote value using symbol or lambda
      # By default extracts raw values for comparison with to_google_json
      # Pass apply_reverse_transform: true to convert to local format
      def remote_value(remote, name, apply_reverse_transform: false)
        mapping = self.class.field_mappings[name]
        raise ArgumentError, "Unknown field mapping: #{name}" unless mapping

        extractor = mapping[:remote]

        raw = if extractor.is_a?(Symbol)
          remote.respond_to?(extractor) ? remote.send(extractor) : nil
        else
          extractor.call(remote)
        end

        # Only apply reverse_transform if explicitly requested
        if apply_reverse_transform && mapping[:reverse_transform] && !raw.nil?
          apply_transform(mapping[:reverse_transform], raw)
        else
          raw
        end
      end

      # Generate hash of local values (what we would send to Google)
      def to_google_json
        self.class.field_mappings.each_with_object({}) do |(name, _mapping), hash|
          hash[name] = local_value(name)
        end
      end

      # Generate hash of remote values in local format (reverse transforms applied)
      def from_google_json(remote = nil)
        remote ||= fetch
        return nil unless remote

        self.class.field_mappings.each_with_object({}) do |(name, _mapping), hash|
          hash[name] = remote_value(remote, name, apply_reverse_transform: true)
        end
      end

      # Default comparison - can be overridden per resource
      # Compares in Google format (transformed local vs raw remote)
      def compare_fields(remote)
        local_json = to_google_json

        GoogleAds::FieldCompare.build do |c|
          self.class.field_mappings.each do |name, mapping|
            # Check if this field should be skipped
            if should_skip_comparison?(mapping[:skip_comparison])
              c.skip(name)
              next
            end

            remote_val = remote_value(remote, name, apply_reverse_transform: false)
            c.check(name, local: local_json[name], remote: remote_val) do
              local_json[name] == remote_val
            end
          end
        end
      end

      def fields_match?(remote)
        compare_fields(remote).match?
      end

      # Get list of immutable fields (for sync_plan)
      def immutable_fields
        self.class.immutable_fields
      end

      # Get list of mutable fields (for sync_plan)
      def mutable_fields
        self.class.mutable_fields
      end

      private

      # Evaluate skip_comparison option
      # Accepts: true, false, Proc, or Symbol (method name)
      def should_skip_comparison?(skip_option)
        case skip_option
        when true then true
        when false, nil then false
        when Proc then instance_exec(&skip_option)
        when Symbol then send(skip_option)
        else false
        end
      end

      def apply_transform(transform, value)
        if transform.is_a?(Proc)
          transform.call(value)
        elsif transform.is_a?(Hash)
          transform[value]
        else
          value
        end
      end
    end
  end
end
