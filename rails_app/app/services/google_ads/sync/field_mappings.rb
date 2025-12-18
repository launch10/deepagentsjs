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

      TO_SYMBOL = ->(value) { value.to_sym }

      CAMPAIGN_FIELDS = {
        name: {
          our_field: :name,
          their_field: :name,
          transform: ITSELF
        },
        status: {
          our_field: :google_status,
          their_field: :status,
          transform: TO_SYMBOL
        },
        advertising_channel_type: {
          our_field: :google_advertising_channel_type,
          their_field: :advertising_channel_type,
          transform: TO_SYMBOL
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

      ADS_ACCOUNT_FIELDS = {
        descriptive_name: {
          our_field: :google_descriptive_name,
          their_field: :descriptive_name,
          transform: ITSELF
        },
        currency_code: {
          our_field: :google_currency_code,
          their_field: :currency_code,
          transform: ITSELF
        },
        time_zone: {
          our_field: :google_time_zone,
          their_field: :time_zone,
          transform: ITSELF
        },
        status: {
          our_field: :google_status,
          their_field: :status,
          transform: ITSELF
        },
        auto_tagging_enabled: {
          our_field: :google_auto_tagging_enabled,
          their_field: :auto_tagging_enabled,
          transform: ITSELF
        }
      }.freeze

      TARGETED_TO_NEGATIVE = ->(targeted) { !targeted }
      NEGATIVE_TO_TARGETED = ->(negative) { !negative }

      LOCATION_TARGET_FIELDS = {
        geo_target_constant: {
          our_field: :google_criterion_id,
          their_field: :geo_target_constant,
          transform: ITSELF,
          nested_field: :location
        },
        negative: {
          our_field: :negative,
          their_field: :negative,
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
            if google_resource.key?(their_field)
              google_resource[their_field]
            elsif google_resource.key?(their_field.to_s)
              google_resource[their_field.to_s]
            else
              next
            end
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
        when ::Campaign.name
          CAMPAIGN_FIELDS
        when AdGroup.name
          AD_GROUP_FIELDS
        when AdsAccount.name
          ADS_ACCOUNT_FIELDS
        when AdLocationTarget.name
          LOCATION_TARGET_FIELDS
        else
          raise ArgumentError, "Unknown resource type: #{resource_type}"
        end
      end
    end
  end
end
