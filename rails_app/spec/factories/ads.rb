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
FactoryBot.define do
  factory :ad do
    association :ad_group

    status { "draft" }
  end
end
