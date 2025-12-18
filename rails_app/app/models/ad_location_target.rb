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
  include GoogleMappable
  include GoogleSyncable

  platform_setting :google, :criterion_id
  platform_setting :google, :remote_criterion_id

  use_google_sync GoogleAds::LocationTarget

  after_google_sync do |result|
    if result.resource_name.present?
      criterion_id = result.resource_name.split("~").last
      update_column(:platform_settings, platform_settings.deep_merge("google" => { "remote_criterion_id" => criterion_id }))
    end
  end

  acts_as_paranoid

  belongs_to :campaign

  TARGET_TYPES = %w[geo_location radius location_group].freeze
  LOCATION_TYPES = %w[COUNTRY REGION CITY POSTAL DMA AIRPORT UNIVERSITY].freeze
  RADIUS_UNITS = %w[MILES KILOMETERS].freeze

  validates :target_type, presence: true, inclusion: { in: TARGET_TYPES }
  validates :location_type, inclusion: { in: LOCATION_TYPES }, allow_nil: true
  validates :radius_units, inclusion: { in: RADIUS_UNITS }, allow_nil: true

  validate :geo_location_fields_required
  validate :radius_fields_required

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

  def geo_target_constant=(value)
    self.google_criterion_id = value
  end

  def geo_target_constant
    google_criterion_id
  end

  def google_criterion_id=(value)
    return if value.blank?

    normalized = if value.to_s.start_with?("geoTargetConstants/")
      value
    else
      "geoTargetConstants/#{value}"
    end

    platform_settings["google"]["criterion_id"] = normalized
  end

  # Auto-upcase location_type
  def location_type=(value)
    super(value&.upcase)
  end

  # Auto-upcase radius_units
  def radius_units=(value)
    super(value&.upcase)
  end

  # @return [Hash] JSON representation for the frontend
  # @example Geo location target
  #   {
  #     target_type: 'geo_location',
  #     location_identifier: 'geoTargetConstants/2840',
  #     location_name: 'United States',
  #     location_type: 'COUNTRY',
  #     country_code: 'US',
  #     negative: false,
  #     radius: 10,
  #     radius_units: 'MILES'
  #   }
  # @example Radius target
  #   {
  #     target_type: 'radius',
  #     address_line_1: '38 avenue de l\'Opéra',
  #     city: 'Paris',
  #     postal_code: '75002',
  #     country_code: 'FR',
  #     radius: 10,
  #     radius_units: 'MILES',
  #     negative: false
  #   }
  def as_json(_options = {})
    base = {
      target_type: target_type,
      targeted: targeted
    }

    if geo_location?
      base.merge(
        geo_target_constant: google_criterion_id,
        location_name: location_name,
        location_type: location_type,
        country_code: country_code,
        radius: radius&.to_f,
        radius_units: radius_units&.downcase
      )
    elsif radius?
      base.merge(
        address_line_1: address_line_1,
        city: city,
        state: state,
        postal_code: postal_code,
        country_code: country_code,
        radius: radius&.to_f,
        radius_units: radius_units&.downcase,
        latitude: latitude&.to_f,
        longitude: longitude&.to_f
      )
    else
      base
    end
  end

  private

  def infer_target_type
    if google_criterion_id.present?
      self.target_type = "geo_location"
    elsif address_line_1.present? || latitude.present?
      self.target_type = "radius"
    end
  end

  def geo_location_fields_required
    return unless geo_location?

    errors.add(:google_criterion_id, "can't be blank") if google_criterion_id.blank?
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

end
