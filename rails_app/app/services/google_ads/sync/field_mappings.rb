module GoogleAds
  module Sync
    module FieldMappings
      CENTS_TO_MICROS = ->(cents) { cents * 10_000 }
      MICROS_TO_CENTS = ->(micros) { micros / 10_000 }
      DOLLARS_TO_MICROS = ->(dollars) { dollars * 1_000_000 }
      MICROS_TO_DOLLARS = ->(micros) { micros / 1_000_000.0 }
      ITSELF = ->(value) { value }

      BUDGET_FIELDS = {
        daily_budget_cents: {
          our_field: :daily_budget_cents,
          their_field: :amount_micros,
          transform: CENTS_TO_MICROS,
          reverse_transform: MICROS_TO_CENTS
        },
        name: {
          our_field: :google_budget_name,
          their_field: :name,
          transform: ITSELF
        }
      }.freeze

      CAMPAIGN_FIELDS = {
        name: {
          our_field: :name,
          their_field: :name,
          transform: ITSELF
        },
        status: {
          our_field: :status,
          their_field: :status,
          transform: ITSELF
        },
        advertising_channel_type: {
          our_field: :advertising_channel_type,
          their_field: :advertising_channel_type,
          transform: ITSELF
        },
        bidding_strategy_type: {
          our_field: :bidding_strategy_type,
          their_field: :bidding_strategy_type,
          transform: ITSELF
        }
      }.freeze

      AD_GROUP_FIELDS = {
        name: {
          our_field: :name,
          their_field: :name,
          transform: ITSELF
        },
        status: {
          our_field: :status,
          their_field: :status,
          transform: ITSELF
        },
        type: {
          our_field: :type,
          their_field: :type,
          transform: ITSELF
        },
        cpc_bid_cents: {
          our_field: :cpc_bid_cents,
          their_field: :cpc_bid_micros,
          transform: CENTS_TO_MICROS,
          reverse_transform: MICROS_TO_CENTS
        },
        cpc_bid_micros: {
          our_field: :cpc_bid_micros,
          their_field: :cpc_bid_micros,
          transform: ITSELF
        }
      }.freeze

      def self.to_google(resource)
        field_mapping = self.for(resource.class)
        result = {}
        field_mapping.each do |_key, mapping|
          our_field = mapping[:our_field]
          value = resource.respond_to?(our_field) ? resource.send(our_field) : nil
          next if value.nil?

          result[mapping[:their_field]] = mapping[:transform].call(value)
        end
        result
      end

      def self.from_google(google_resource, resource_class)
        field_mapping = self.for(resource_class)
        result = {}
        field_mapping.each do |_our_key, mapping|
          their_field = mapping[:their_field]
          value = if google_resource.is_a?(Hash)
            next unless google_resource.key?(their_field) || google_resource.key?(their_field.to_s)
            google_resource[their_field] || google_resource[their_field.to_s]
          else
            next unless google_resource.respond_to?(their_field)
            google_resource.send(their_field)
          end

          reverse_transform = mapping[:reverse_transform] || ITSELF
          result[mapping[:our_field]] = reverse_transform.call(value)
        end
        result
      end

      def self.for(resource_type)
        case resource_type.name
        when AdBudget.name
          BUDGET_FIELDS
        when Campaign.name
          CAMPAIGN_FIELDS
        when AdGroup.name
          AD_GROUP_FIELDS
        else
          raise ArgumentError, "Unknown resource type: #{resource_type}"
        end
      end
    end
  end
end
