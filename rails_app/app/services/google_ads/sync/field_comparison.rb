module GoogleAds
  module Sync
    class FieldComparison
      attr_reader :field, :our_field, :our_value, :their_field, :their_value, :transform

      def initialize(field:, our_field:, our_value:, their_field:, their_value:, transform: nil)
        @field = field
        @our_field = our_field
        @our_value = our_value
        @their_field = their_field
        @their_value = their_value
        @transform = transform
      end

      def transformed_our_value
        return our_value if transform.nil?
        transform.call(our_value)
      end

      def values_match?
        normalize(transformed_our_value) == normalize(their_value)
      end

      def to_h
        {
          field: field,
          our_field: our_field,
          our_value: our_value,
          their_field: their_field,
          their_value: their_value,
          transformed_our_value: transformed_our_value,
          values_match: values_match?
        }
      end

      private

      def normalize(value)
        value.is_a?(Symbol) ? value.to_s : value
      end
    end
  end
end
