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
require 'rails_helper'

RSpec.describe AdLocationTarget, type: :model do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, account: account) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }

  describe 'validations' do
    describe 'unique google_geo_target_constant per campaign' do
      it 'allows a single location target with a geo_target_constant' do
        target = campaign.location_targets.build(
          target_type: 'geo_location',
          location_name: 'United States',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/2840' } }
        )
        expect(target).to be_valid
      end

      it 'prevents duplicate google_geo_target_constant within the same campaign' do
        campaign.location_targets.create!(
          target_type: 'geo_location',
          location_name: 'California',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/21137' } }
        )
        duplicate = campaign.location_targets.build(
          target_type: 'geo_location',
          location_name: 'California',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/21137' } }
        )
        expect(duplicate).not_to be_valid
        expect(duplicate.errors[:google_geo_target_constant]).to include('has already been taken for this campaign')
      end

      it 'allows same google_geo_target_constant across different campaigns' do
        other_campaign = create(:campaign, account: account, project: project, website: website)

        campaign.location_targets.create!(
          target_type: 'geo_location',
          location_name: 'California',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/21137' } }
        )
        target = other_campaign.location_targets.build(
          target_type: 'geo_location',
          location_name: 'California',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/21137' } }
        )
        expect(target).to be_valid
      end

      it 'allows multiple targets with nil geo_target_constant (e.g., radius targets)' do
        campaign.location_targets.create!(
          target_type: 'radius',
          city: 'San Francisco',
          country_code: 'US',
          radius: 10,
          radius_units: 'MILES'
        )
        target = campaign.location_targets.build(
          target_type: 'radius',
          city: 'Los Angeles',
          country_code: 'US',
          radius: 15,
          radius_units: 'MILES'
        )
        expect(target).to be_valid
      end
    end

    describe 'United States (2840) exclusivity' do
      it 'allows United States (2840) as the only location target' do
        target = campaign.location_targets.build(
          target_type: 'geo_location',
          location_name: 'United States',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/2840' } }
        )
        expect(target).to be_valid
      end

      it 'prevents adding United States (2840) when other location targets exist' do
        campaign.location_targets.create!(
          target_type: 'geo_location',
          location_name: 'California',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/21137' } }
        )
        us_target = campaign.location_targets.build(
          target_type: 'geo_location',
          location_name: 'United States',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/2840' } }
        )
        expect(us_target).not_to be_valid
        expect(us_target.errors[:google_geo_target_constant]).to include('United States cannot be added when more specific locations are targeted')
      end

      it 'prevents adding other locations when United States (2840) exists' do
        campaign.location_targets.create!(
          target_type: 'geo_location',
          location_name: 'United States',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/2840' } }
        )
        ca_target = campaign.location_targets.build(
          target_type: 'geo_location',
          location_name: 'California',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/21137' } }
        )
        expect(ca_target).not_to be_valid
        expect(ca_target.errors[:google_geo_target_constant]).to include('cannot add specific locations when United States is already targeted')
      end

      it 'allows radius targets alongside United States (2840)' do
        campaign.location_targets.create!(
          target_type: 'geo_location',
          location_name: 'United States',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/2840' } }
        )
        radius_target = campaign.location_targets.build(
          target_type: 'radius',
          city: 'San Francisco',
          country_code: 'US',
          radius: 10,
          radius_units: 'MILES'
        )
        expect(radius_target).to be_valid
      end

      it 'allows United States (2840) alongside radius targets' do
        campaign.location_targets.create!(
          target_type: 'radius',
          city: 'San Francisco',
          country_code: 'US',
          radius: 10,
          radius_units: 'MILES'
        )
        us_target = campaign.location_targets.build(
          target_type: 'geo_location',
          location_name: 'United States',
          country_code: 'US',
          platform_settings: { 'google' => { 'geo_target_constant' => 'geoTargetConstants/2840' } }
        )
        expect(us_target).to be_valid
      end
    end
  end
end
