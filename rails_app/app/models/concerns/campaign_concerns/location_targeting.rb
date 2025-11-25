module CampaignConcerns
  module LocationTargeting
    extend ActiveSupport::Concern

    def location_targeting
      @location_targeting ||= ::LocationTargeting.new(self)
    end

    def has_location_targeting?
      location_targets.targeted.exists?
    end

    def location_targets_json
      location_targets.map(&:as_json)
    end

    # Updates location targets from frontend data
    #
    # @param targets_data [Array<Hash>] array of location target configurations
    # @option targets_data [String] :target_type 'geo_location' or 'radius'
    # @option targets_data [String] :location_name human-readable name
    # @option targets_data [String] :location_type COUNTRY, CITY, etc.
    # @option targets_data [String] :geo_target_constant Google's criterion ID
    # @option targets_data [Boolean] :targeted true for targeting, false for exclusion
    # @option targets_data [Float] :radius optional radius in miles/km
    # @option targets_data [String] :radius_units 'MILES' or 'KILOMETERS'
    #
    # @example Update with geo location
    #   campaign.update_location_targets([
    #     {
    #       target_type: 'geo_location',
    #       location_name: 'United States',
    #       location_type: 'COUNTRY',
    #       country_code: 'US',
    #       geo_target_constant: 'geoTargetConstants/2840',
    #       targeted: true,
    #       radius: 10,
    #       radius_units: 'miles'
    #     }
    #   ])
    #
    # @return [void]
    def update_location_targets(targets_data)
      Campaign.transaction do
        location_targets.destroy_all

        targets = Array(targets_data).each do |target_data|
          build_location_target(target_data)
        end
        LocationTarget.import(targets)
      end
    end

    private

    def build_location_target(data)
      target_type = data[:target_type] || infer_target_type(data)

      attrs = {
        target_type: target_type,
        negative: !data.fetch(:targeted, true)
      }

      if target_type == 'geo_location'
        attrs.merge!(
          location_identifier: normalize_geo_constant(data[:geo_target_constant] || data[:location_identifier]),
          location_name: data[:location_name],
          location_type: data[:location_type]&.upcase,
          country_code: data[:country_code],
          radius: data[:radius],
          radius_units: data[:radius_units]&.upcase
        )
      elsif target_type == 'radius'
        attrs.merge!(
          address_line_1: data[:address_line_1],
          city: data[:city],
          state: data[:state],
          postal_code: data[:postal_code],
          country_code: data[:country_code],
          radius: data[:radius],
          radius_units: data[:radius_units]&.upcase,
          latitude: data[:latitude],
          longitude: data[:longitude]
        )
      end

      location_targets.new(attrs)
    end

    def infer_target_type(data)
      if data[:geo_target_constant] || data[:location_identifier]
        'geo_location'
      elsif data[:address_line_1] || data[:latitude]
        'radius'
      else
        'geo_location'
      end
    end

    def normalize_geo_constant(value)
      return nil if value.blank?

      # Convert "2840" to "geoTargetConstants/2840"
      # Or keep "geoTargetConstants/2840" as is
      value.to_s.start_with?('geoTargetConstants/') ? value : "geoTargetConstants/#{value}"
    end
  end
end
