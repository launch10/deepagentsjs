module CampaignConcerns
  module LocationTargeting
    extend ActiveSupport::Concern

    def has_location_targeting?
      location_targets.valid?
    end

    def location_targets_json
      location_targets.map(&:as_json)
    end

    # Updates location targets from frontend data or GeoTargetConstant records
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
    # Can also accept GeoTargetConstant format:
    # @option targets_data [Integer] :criteria_id Google's geo target constant ID
    # @option targets_data [String] :name location name
    # @option targets_data [String] :target_type City, Country, etc (will be upcased to location_type)
    # @option targets_data [String] :country_code two-letter country code
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
    #     }
    #   ])
    #
    # @example Update with GeoTargetConstant data
    #   campaign.update_location_targets([geo_target.as_json])
    #
    # @return [void]
    def update_location_targets(targets_data)
      Campaign.transaction do
        location_targets.destroy_all

        targets = Array(targets_data).map do |target_data|
          location_targets.new(normalize_location_target(target_data))
        end

        errors = []
        targets.each do |target|
          unless target.valid?
            target.errors.full_messages.each do |message|
              errors << "AdLocationTarget: #{message}"
            end
          end
        end

        if errors.any?
          errors.each { |e| self.errors.add(:base, e) }
          raise ActiveRecord::RecordInvalid.new(self)
        end

        if targets.any?
          AdLocationTarget.insert_all(
            targets.map { |t| t.attributes.except("id").merge("created_at" => Time.current, "updated_at" => Time.current) }
          )
        end
      end
      self.reload.location_targets
    end

    # Custom setter for location_targets to work with strong parameters
    def location_targets=(targets_data)
      update_location_targets(targets_data) if targets_data.present?
    end

    private

    # Normalizes location target data to AdLocationTarget format
    # Accepts both AdLocationTarget format and GeoTargetConstant format
    #
    # @param data [Hash] location target data
    # @return [Hash] normalized data for AdLocationTarget
    def normalize_location_target(data)
      data = data.with_indifferent_access

      # If it has criteria_id, look up canonical data from GeoTargetConstant
      if data[:criteria_id].present?
        geo_target = GeoTargetConstant.find_by(criteria_id: data[:criteria_id])
        raise ActiveRecord::RecordNotFound, "GeoTargetConstant not found for criteria_id: #{data[:criteria_id]}" unless geo_target

        {
          target_type: "geo_location",
          geo_target_constant: geo_target.geo_target_constant,
          location_name: geo_target.canonical_name,
          location_type: geo_target.target_type,
          country_code: geo_target.country_code,
          targeted: data.fetch(:targeted, true)
        }
      else
        # Already in AdLocationTarget format, pass through
        data
      end
    end
  end
end
