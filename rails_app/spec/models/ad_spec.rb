# == Schema Information
#
# Table name: ads
#
#  id                :bigint           not null, primary key
#  deleted_at        :datetime
#  display_path_1    :string
#  display_path_2    :string
#  platform_settings :jsonb
#  status            :string           default("draft")
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  ad_group_id       :bigint
#
# Indexes
#
#  index_ads_on_ad_group_id             (ad_group_id)
#  index_ads_on_ad_group_id_and_status  (ad_group_id,status)
#  index_ads_on_deleted_at              (deleted_at)
#  index_ads_on_google_id               ((((platform_settings -> 'google'::text) ->> 'ad_id'::text)))
#  index_ads_on_platform_settings       (platform_settings) USING gin
#  index_ads_on_status                  (status)
#
require 'rails_helper'

RSpec.describe Ad, type: :model do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, account: account, project: project) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:ad_group) { create(:ad_group, campaign: campaign) }
  let(:ad) { create(:ad, ad_group: ad_group) }

  describe 'associations' do
    it 'belongs to ad_group' do
      expect(ad.ad_group).to eq(ad_group)
    end

    it 'has one campaign through ad_group' do
      expect(ad.campaign).to eq(campaign)
    end

    it 'has one website through campaign' do
      expect(ad.website).to eq(website)
    end

    it 'has many headlines' do
      headline = create(:ad_headline, ad: ad)
      expect(ad.headlines).to include(headline)
    end

    it 'has many descriptions' do
      description = create(:ad_description, ad: ad)
      expect(ad.descriptions).to include(description)
    end
  end

  describe '#final_urls' do
    context 'when website has a website_url with root path' do
      before do
        domain = create(:domain, account: account, domain: "example.launch10.ai")
        create(:website_url, website: website, account: account, domain: domain, path: "/")
      end

      it 'returns the full URL array with cloudEnv in non-production' do
        expect(ad.final_urls).to eq(["https://example.launch10.ai/?cloudEnv=#{Cloudflare.deploy_env}"])
      end
    end

    context 'when website has a website_url with a path' do
      before do
        domain = create(:domain, account: account, domain: "example.launch10.ai")
        create(:website_url, website: website, account: account, domain: domain, path: "/campaign")
      end

      it 'returns the full URL with path and cloudEnv in non-production' do
        expect(ad.final_urls).to eq(["https://example.launch10.ai/campaign?cloudEnv=#{Cloudflare.deploy_env}"])
      end
    end

    context 'when website has no website_url' do
      it 'returns empty array' do
        expect(ad.final_urls).to eq([])
      end
    end
  end

  describe 'display paths' do
    it 'allows setting display_path_1' do
      ad.update!(display_path_1: "Shop")
      expect(ad.reload.display_path_1).to eq("Shop")
    end

    it 'allows setting display_path_2' do
      ad.update!(display_path_2: "Now")
      expect(ad.reload.display_path_2).to eq("Now")
    end
  end

  describe 'platform_settings' do
    it 'has google_ad_id accessor' do
      ad.google_ad_id = "12345"
      expect(ad.google_ad_id).to eq("12345")
    end
  end
end
