module GoogleAds
  module Sync
    module FieldMappings
      CENTS_TO_MICROS = ->(cents) { cents * 10_000 }
      MICROS_TO_CENTS = ->(micros) { micros / 10_000 }
      DOLLARS_TO_MICROS = ->(dollars) { dollars * 1_000_000 }
      MICROS_TO_DOLLARS = ->(micros) { micros / 1_000_000.0 }
      IDENTITY = ->(value) { value }

      BUDGET_FIELDS = {
        amount_cents: {
          our_field: :amount_cents,
          their_field: :amount_micros,
          transform: CENTS_TO_MICROS
        },
        amount_micros: {
          our_field: :amount_micros,
          their_field: :amount_micros,
          transform: IDENTITY
        },
        delivery_method: {
          our_field: :delivery_method,
          their_field: :delivery_method,
          transform: IDENTITY
        },
        name: {
          our_field: :name,
          their_field: :name,
          transform: IDENTITY
        }
      }.freeze

      CAMPAIGN_FIELDS = {
        name: {
          our_field: :name,
          their_field: :name,
          transform: IDENTITY
        },
        status: {
          our_field: :status,
          their_field: :status,
          transform: IDENTITY
        },
        advertising_channel_type: {
          our_field: :advertising_channel_type,
          their_field: :advertising_channel_type,
          transform: IDENTITY
        },
        bidding_strategy_type: {
          our_field: :bidding_strategy_type,
          their_field: :bidding_strategy_type,
          transform: IDENTITY
        }
      }.freeze

      BIDDING_STRATEGY_FIELDS = {
        name: {
          our_field: :name,
          their_field: :name,
          transform: IDENTITY
        },
        type: {
          our_field: :type,
          their_field: :type,
          transform: IDENTITY
        },
        target_cpa_micros: {
          our_field: :target_cpa_cents,
          their_field: :target_cpa_micros,
          transform: CENTS_TO_MICROS
        },
        target_roas: {
          our_field: :target_roas,
          their_field: :target_roas,
          transform: IDENTITY
        }
      }.freeze

      AD_GROUP_FIELDS = {
        name: {
          our_field: :name,
          their_field: :name,
          transform: IDENTITY
        },
        status: {
          our_field: :status,
          their_field: :status,
          transform: IDENTITY
        },
        type: {
          our_field: :type,
          their_field: :type,
          transform: IDENTITY
        },
        cpc_bid_cents: {
          our_field: :cpc_bid_cents,
          their_field: :cpc_bid_micros,
          transform: CENTS_TO_MICROS
        },
        cpc_bid_micros: {
          our_field: :cpc_bid_micros,
          their_field: :cpc_bid_micros,
          transform: IDENTITY
        }
      }.freeze

      def self.for(resource_type)
        case resource_type
        when :budget, :campaign_budget
          BUDGET_FIELDS
        when :campaign
          CAMPAIGN_FIELDS
        when :bidding_strategy
          BIDDING_STRATEGY_FIELDS
        when :ad_group
          AD_GROUP_FIELDS
        else
          raise ArgumentError, "Unknown resource type: #{resource_type}"
        end
      end
    end
  end
end
