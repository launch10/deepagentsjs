# == Schema Information
#
# Table name: ad_location_targets
#
#  id                  :bigint           not null, primary key
#  address_line_1      :string
#  city                :string
#  country_code        :string
#  deleted_at          :datetime
#  latitude            :decimal(10, 6)
#  location_identifier :string
#  location_name       :string
#  location_type       :string
#  longitude           :decimal(10, 6)
#  platform_settings   :jsonb
#  postal_code         :string
#  radius              :decimal(10, 2)
#  radius_units        :string
#  state               :string
#  target_type         :string           not null
#  targeted            :boolean          default(TRUE), not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  campaign_id         :bigint
#
# Indexes
#
#  index_ad_location_targets_on_campaign_id          (campaign_id)
#  index_ad_location_targets_on_criterion_id         ((((platform_settings -> 'google'::text) ->> 'criterion_id'::text)))
#  index_ad_location_targets_on_deleted_at           (deleted_at)
#  index_ad_location_targets_on_location_identifier  (location_identifier)
#  index_ad_location_targets_on_platform_settings    (platform_settings) USING gin
#
class AdLocationTarget < ApplicationRecord
  include PlatformSettings

  # geo_target_constant: The well-known Google location ID (e.g., "geoTargetConstants/2840" for USA)
  # criterion_id: The ID Google assigns when you create this CampaignCriterion
  platform_setting :google, :geo_target_constant
  platform_setting :google, :criterion_id

  def to_google_json
    GoogleAds::Resources::LocationTarget.new(self).to_google_json
  end

  def google_sync
    google_syncer.sync
  end

  def google_synced?
    google_syncer.synced?
  end

  def google_delete
    google_syncer.delete
  end

  def google_fetch
    google_syncer.fetch
  end

  def google_syncer
    @google_syncer ||= GoogleAds::Resources::LocationTarget.new(self)
  end

  acts_as_paranoid

  belongs_to :campaign

  TARGET_TYPES = %w[geo_location radius location_group].freeze
  # Valid location types come from GeoTargetConstant (the source of truth)
  LOCATION_TYPES = GeoTargetConstant::TARGET_TYPES.freeze
  RADIUS_UNITS = %w[MILES KILOMETERS].freeze

  validates :target_type, presence: true, inclusion: { in: TARGET_TYPES }
  validates :location_type, inclusion: { in: LOCATION_TYPES }, allow_nil: true
  validates :radius_units, inclusion: { in: RADIUS_UNITS }, allow_nil: true

  validate :geo_location_fields_required
  validate :radius_fields_required
  validate :unique_geo_target_constant_per_campaign
  validate :us_country_exclusivity

  scope :targeted, -> { where(targeted: true) }
  scope :excluded, -> { where(targeted: false) }
  scope :geo_locations, -> { where(target_type: "geo_location") }
  scope :radius_targets, -> { where(target_type: "radius") }
  scope :location_groups, -> { where(target_type: "location_group") }

  before_validation :infer_target_type, if: -> { target_type.blank? }

  def geo_location?
    target_type == "geo_location"
  end

  def radius?
    target_type == "radius"
  end

  def location_group?
    target_type == "location_group"
  end

  def excluded?
    !targeted
  end

  def negative
    !targeted
  end

  # Alias for google_geo_target_constant (matches Google API terminology)
  def geo_target_constant=(value)
    self.google_geo_target_constant = value
  end

  def geo_target_constant
    google_geo_target_constant
  end

  # Custom setter that normalizes the geo_target_constant format
  def google_geo_target_constant=(value)
    return if value.blank?

    normalized = if value.to_s.start_with?("geoTargetConstants/")
      value
    else
      "geoTargetConstants/#{value}"
    end

    platform_settings["google"]["geo_target_constant"] = normalized
  end


  # Auto-upcase radius_units
  def radius_units=(value)
    super(value&.upcase)
  end

  # @return [Hash] JSON representation for the frontend (GeoTargetConstant format)
  # @example Geo location target
  #   {
  #     criteria_id: 2840,
  #     name: 'United States',
  #     target_type: 'Country',
  #     country_code: 'US',
  #     targeted: true
  #   }
  # @example Radius target
  #   {
  #     ad_location_target_type: 'radius',
  #     address_line_1: '38 avenue de l\'Opéra',
  #     city: 'Paris',
  #     postal_code: '75002',
  #     country_code: 'FR',
  #     radius: 10,
  #     radius_units: 'MILES',
  #     targeted: true
  #   }
  def as_json(_options = {})
    if geo_location?
      # Return GeoTargetConstant format for geo locations
      {
        criteria_id: google_geo_target_constant&.gsub("geoTargetConstants/", "")&.to_i,
        name: location_name,
        target_type: location_type&.titleize,
        country_code: country_code,
        targeted: targeted
      }
    elsif radius?
      {
        ad_location_target_type: "radius",
        address_line_1: address_line_1,
        city: city,
        state: state,
        postal_code: postal_code,
        country_code: country_code,
        radius: radius&.to_f,
        radius_units: radius_units&.downcase,
        latitude: latitude&.to_f,
        longitude: longitude&.to_f,
        targeted: targeted
      }
    else
      {
        ad_location_target_type: target_type,
        targeted: targeted
      }
    end
  end

  private

  def infer_target_type
    if google_geo_target_constant.present?
      self.target_type = "geo_location"
    elsif address_line_1.present? || latitude.present?
      self.target_type = "radius"
    end
  end

  def geo_location_fields_required
    return unless geo_location?

    errors.add(:google_geo_target_constant, "can't be blank") if google_geo_target_constant.blank?
    errors.add(:location_name, "can't be blank") if location_name.blank?
    errors.add(:country_code, "can't be blank") if country_code.blank?
  end

  def radius_fields_required
    return unless radius?

    errors.add(:radius, "can't be blank") if radius.blank?
    errors.add(:radius_units, "can't be blank") if radius_units.blank?
    errors.add(:city, "can't be blank") if city.blank?
    errors.add(:country_code, "can't be blank") if country_code.blank?
  end

  def unique_geo_target_constant_per_campaign
    return if google_geo_target_constant.blank?

    existing = campaign.location_targets.where.not(id: id).find do |target|
      target.google_geo_target_constant == google_geo_target_constant
    end

    errors.add(:google_geo_target_constant, "has already been taken for this campaign") if existing
  end

  def us_country_exclusivity
    return unless geo_location?
    return if google_geo_target_constant.blank?

    us_geo_target = "geoTargetConstants/2840"
    other_geo_targets = campaign.location_targets.geo_locations.where.not(id: id)

    if google_geo_target_constant == us_geo_target
      # Adding US - check if other geo locations exist
      if other_geo_targets.any?
        errors.add(:google_geo_target_constant, "United States cannot be added when more specific locations are targeted")
      end
    else
      # Adding non-US - check if US exists
      if other_geo_targets.any? { |t| t.google_geo_target_constant == us_geo_target }
        errors.add(:google_geo_target_constant, "cannot add specific locations when United States is already targeted")
      end
    end
  end
end
