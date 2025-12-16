# frozen_string_literal: true

module APISchemas
  module GeoTargetConstant
    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          criteria_id: {type: :integer, description: 'Google Ads criteria ID'},
          name: {type: :string, description: 'Location name'},
          canonical_name: {type: :string, description: 'Full canonical name with hierarchy'},
          country_code: {type: :string, nullable: true, description: 'ISO country code'},
          target_type: {type: :string, description: 'Location type (City, Country, etc.)'},
          status: {type: :string, description: 'Active status'}
        },
        required: %w[id criteria_id name canonical_name target_type status]
      }
    end

    def self.index_response
      {
        type: :array,
        items: response
      }
    end
  end
end
