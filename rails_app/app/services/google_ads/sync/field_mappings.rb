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
          transform: TO_SYMBOL,
          immutable: true
        },
        contains_eu_political_advertising: {
          our_field: :google_contains_eu_political_advertising,
          their_field: :contains_eu_political_advertising,
          transform: ->(value) { value ? :CONTAINS_EU_POLITICAL_ADVERTISING : :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING },
          their_value_transform: ->(value) { (value == :UNSPECIFIED) ? :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING : value },
          immutable: true
        }
      }.freeze

      AD_GROUP_FIELDS = {
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
        type: {
          our_field: :google_type,
          their_field: :type,
          transform: TO_SYMBOL
        },
        cpc_bid_micros: {
          our_field: :google_cpc_bid_micros,
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
          transform: ITSELF,
          ignore_when: -> { GoogleAds.is_test_mode? }
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

      DAY_OF_WEEK_TO_SYMBOL = ->(day) {
        {
          "Monday" => :MONDAY,
          "Tuesday" => :TUESDAY,
          "Wednesday" => :WEDNESDAY,
          "Thursday" => :THURSDAY,
          "Friday" => :FRIDAY,
          "Saturday" => :SATURDAY,
          "Sunday" => :SUNDAY
        }[day]
      }

      MINUTE_TO_SYMBOL = ->(minute) {
        { 0 => :ZERO, 15 => :FIFTEEN, 30 => :THIRTY, 45 => :FORTY_FIVE }[minute] || :ZERO
      }

      AD_SCHEDULE_FIELDS = {
        day_of_week: {
          our_field: :day_of_week,
          their_field: :day_of_week,
          transform: DAY_OF_WEEK_TO_SYMBOL,
          nested_field: :ad_schedule
        },
        start_hour: {
          our_field: :start_hour,
          their_field: :start_hour,
          transform: ITSELF,
          nested_field: :ad_schedule
        },
        start_minute: {
          our_field: :start_minute,
          their_field: :start_minute,
          transform: MINUTE_TO_SYMBOL,
          nested_field: :ad_schedule
        },
        end_hour: {
          our_field: :end_hour,
          their_field: :end_hour,
          transform: ITSELF,
          nested_field: :ad_schedule
        },
        end_minute: {
          our_field: :end_minute,
          their_field: :end_minute,
          transform: MINUTE_TO_SYMBOL,
          nested_field: :ad_schedule
        }
      }.freeze

      MATCH_TYPE_TO_SYMBOL = ->(match_type) { match_type.upcase.to_sym }

      STATUS_TO_GOOGLE = ->(status) { (status == "active") ? :ENABLED : :PAUSED }

      AD_FIELDS = {
        status: {
          our_field: :status,
          their_field: :status,
          transform: STATUS_TO_GOOGLE
        },
        display_path_1: {
          our_field: :display_path_1,
          their_field: :path1,
          transform: ITSELF,
          nested_fields: [:ad, :responsive_search_ad]
        },
        display_path_2: {
          our_field: :display_path_2,
          their_field: :path2,
          transform: ITSELF,
          nested_fields: [:ad, :responsive_search_ad]
        }
      }.freeze

      KEYWORD_FIELDS = {
        text: {
          our_field: :text,
          their_field: :text,
          transform: ITSELF,
          nested_field: :keyword
        },
        match_type: {
          our_field: :match_type,
          their_field: :match_type,
          transform: MATCH_TYPE_TO_SYMBOL,
          nested_field: :keyword
        }
      }.freeze

      CALLOUT_FIELDS = {
        text: {
          our_field: :text,
          their_field: :callout_text,
          transform: ITSELF,
          nested_field: :callout_asset
        }
      }.freeze

      CATEGORY_TO_HEADER = ->(category) {
        StructuredSnippetCategoriesConfig.definitions.dig(category, :key) || category.titleize
      }

      STRUCTURED_SNIPPET_FIELDS = {
        category: {
          our_field: :category,
          their_field: :header,
          transform: CATEGORY_TO_HEADER,
          nested_field: :structured_snippet_asset
        },
        values: {
          our_field: :values,
          their_field: :values,
          transform: ITSELF,
          nested_field: :structured_snippet_asset
        }
      }.freeze

      ACCOUNT_INVITATION_FIELDS = {
        email_address: {
          our_field: :email_address,
          their_field: :email_address,
          transform: ITSELF
        },
        access_role: {
          our_field: :google_access_role,
          their_field: :access_role,
          transform: TO_SYMBOL
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
        when ::AdGroup.name
          AD_GROUP_FIELDS
        when AdsAccount.name
          ADS_ACCOUNT_FIELDS
        when AdLocationTarget.name
          LOCATION_TARGET_FIELDS
        when ::AdSchedule.name
          AD_SCHEDULE_FIELDS
        when ::AdKeyword.name
          KEYWORD_FIELDS
        when ::Ad.name
          AD_FIELDS
        when ::AdCallout.name
          CALLOUT_FIELDS
        when ::AdStructuredSnippet.name
          STRUCTURED_SNIPPET_FIELDS
        when AdsAccountInvitation.name
          ACCOUNT_INVITATION_FIELDS
        else
          raise ArgumentError, "Unknown resource type: #{resource_type}"
        end
      end
    end
  end
end
