module CampaignConcerns
  module LocationTargeting
    extend ActiveSupport::Concern

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

        targets = Array(targets_data).map do |target_data|
          location_targets.new(target_data)
        end

        AdLocationTarget.import(targets, validate: false)
      end
    end
  end
end
