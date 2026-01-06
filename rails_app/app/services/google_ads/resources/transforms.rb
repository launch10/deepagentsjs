module GoogleAds
  module Resources
    module Transforms
      # Identity transforms
      ITSELF = ->(value) { value }
      TO_SYMBOL = ->(value) { value&.to_sym }
      TO_STRING = ->(value) { value&.to_s }
      UPCASE_SYMBOL = ->(value) { value.to_s.upcase.to_sym }
      DOWNCASE_STRING = ->(value) { value.to_s.downcase }

      # Money transforms
      # Google Ads uses micros (1/1,000,000 of currency unit)
      # We store cents in the database (1/100 of currency unit)
      CENTS_TO_MICROS = ->(cents) { cents * 10_000 }
      MICROS_TO_CENTS = ->(micros) { micros / 10_000 }
      DOLLARS_TO_MICROS = ->(dollars) { dollars * 1_000_000 }
      MICROS_TO_DOLLARS = ->(micros) { micros / 1_000_000.0 }

      # Day of week transforms
      DAY_OF_WEEK_MAP = {
        "Monday" => :MONDAY,
        "Tuesday" => :TUESDAY,
        "Wednesday" => :WEDNESDAY,
        "Thursday" => :THURSDAY,
        "Friday" => :FRIDAY,
        "Saturday" => :SATURDAY,
        "Sunday" => :SUNDAY
      }.freeze

      DAY_OF_WEEK_REVERSE_MAP = DAY_OF_WEEK_MAP.invert.freeze

      DAY_OF_WEEK_TO_SYMBOL = ->(day) { DAY_OF_WEEK_MAP[day] }
      SYMBOL_TO_DAY_OF_WEEK = ->(sym) { DAY_OF_WEEK_REVERSE_MAP[sym] }

      # Minute transforms (for ad scheduling)
      MINUTE_MAP = {
        0 => :ZERO,
        15 => :FIFTEEN,
        30 => :THIRTY,
        45 => :FORTY_FIVE
      }.freeze

      MINUTE_REVERSE_MAP = MINUTE_MAP.invert.freeze

      MINUTE_TO_SYMBOL = ->(minute) { MINUTE_MAP[minute] || :ZERO }
      SYMBOL_TO_MINUTE = ->(sym) { MINUTE_REVERSE_MAP[sym] || 0 }

      # Status transforms
      # Local: "active", "paused", etc.
      # Google: :ENABLED, :PAUSED, etc.
      STATUS_TO_GOOGLE = ->(status) { (status == "active") ? :ENABLED : :PAUSED }
      GOOGLE_TO_STATUS = ->(sym) { (sym == :ENABLED) ? "active" : "paused" }

      # Match type transforms (for keywords)
      MATCH_TYPE_TO_SYMBOL = ->(match_type) { match_type.upcase.to_sym }
      SYMBOL_TO_MATCH_TYPE = ->(sym) { sym.to_s.downcase }

      # EU Political advertising transforms
      EU_POLITICAL_TO_SYMBOL = ->(value) {
        value ? :CONTAINS_EU_POLITICAL_ADVERTISING : :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
      }
      SYMBOL_TO_EU_POLITICAL = ->(sym) { sym == :CONTAINS_EU_POLITICAL_ADVERTISING }

      # Structured snippet category to header
      # Uses StructuredSnippetCategoriesConfig to look up the display header
      CATEGORY_TO_HEADER = ->(category) {
        if defined?(StructuredSnippetCategoriesConfig)
          StructuredSnippetCategoriesConfig.definitions.dig(category, :key) || category.titleize
        else
          category.titleize
        end
      }

      # Empty string normalization
      EMPTY_STRING_TO_NIL = ->(value) { value.to_s.empty? ? nil : value }
    end
  end
end
