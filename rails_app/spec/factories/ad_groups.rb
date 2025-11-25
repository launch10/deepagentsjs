# == Schema Information
#
# Table name: ad_groups
#
#  id                :bigint           not null, primary key
#  name              :string
#  platform_settings :jsonb
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  campaign_id       :bigint
#
# Indexes
#
#  index_ad_groups_on_campaign_id           (campaign_id)
#  index_ad_groups_on_campaign_id_and_name  (campaign_id,name)
#  index_ad_groups_on_created_at            (created_at)
#  index_ad_groups_on_name                  (name)
#  index_ad_groups_on_platform_settings     (platform_settings) USING gin
#
FactoryBot.define do
  factory :ad_group do
    association :campaign

    sequence(:name) { |n| "Ad Group #{n}" }
  end
end
