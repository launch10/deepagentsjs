# == Schema Information
#
# Table name: geo_target_constants
#
#  id             :bigint           not null, primary key
#  criteria_id    :bigint           not null
#  name           :string           not null
#  canonical_name :string           not null
#  parent_id      :bigint
#  country_code   :string
#  target_type    :string           not null
#  status         :string           not null, default: "Active"
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#
# Indexes
#
#  index_geo_target_constants_on_canonical_name  (canonical_name) USING gin
#  index_geo_target_constants_on_country_code    (country_code)
#  index_geo_target_constants_on_criteria_id     (criteria_id) UNIQUE
#  index_geo_target_constants_on_name            (name) USING gin
#  index_geo_target_constants_on_parent_id       (parent_id)
#  index_geo_target_constants_on_target_type     (target_type)
#
class GeoTargetConstant < ApplicationRecord
  TARGET_TYPES = %w[Country Region City Postal\ Code DMA Airport University County Borough City\ Region Department District Governorate Municipality National\ Park Neighborhood Okrug Prefecture Province State Territory Union\ Territory].freeze

  validates :criteria_id, presence: true, uniqueness: true
  validates :name, presence: true
  validates :canonical_name, presence: true
  validates :target_type, presence: true
  validates :status, presence: true

  scope :active, -> { where(status: "Active") }
  scope :countries, -> { where(target_type: "Country") }
  scope :regions, -> { where(target_type: "Region") }
  scope :cities, -> { where(target_type: "City") }

  scope :search_api, ->(query) {
    client = GoogleAds.client
    gtc_service = client.service.geo_target_constant

    location_names = client.resource.location_names do |ln|
      [query].each do |name|
        ln.names << name
      end
    end
    geo_consts = gtc_service.suggest_geo_target_constants(
      locale: "en",
      country_code: "US",
      location_names: location_names
    ).geo_target_constant_suggestions
    criteria_ids = geo_consts.map(&:geo_target_constant).map(&:resource_name).map { |c| c.split("/").last.to_i }
    order_clause = criteria_ids.each_with_index.map { |id, idx| "WHEN #{id} THEN #{idx}" }.join(" ")
    where(criteria_id: criteria_ids).order(Arel.sql("CASE criteria_id #{order_clause} END"))
  }

  scope :search, ->(query) {
    return none if query.blank?

    where("name ILIKE :q OR canonical_name ILIKE :q", q: "%#{sanitize_sql_like(query)}%")
      .where(country_code: "US")
      .where.not(target_type: "Congressional District")
      .where.not(status: "Removal Planned")
      .order(Arel.sql("CASE WHEN name ILIKE '#{sanitize_sql_like(query)}%' THEN 0 ELSE 1 END, name"))
      .limit(20)
  }

  def geo_target_constant
    "geoTargetConstants/#{criteria_id}"
  end
end
