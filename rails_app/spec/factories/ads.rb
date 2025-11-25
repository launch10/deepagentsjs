# == Schema Information
#
# Table name: ads
#
#  id             :bigint           not null, primary key
#  display_path_1 :string
#  display_path_2 :string
#  status         :string           default("draft")
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  ad_group_id    :bigint
#
# Indexes
#
#  index_ads_on_ad_group_id             (ad_group_id)
#  index_ads_on_ad_group_id_and_status  (ad_group_id,status)
#  index_ads_on_status                  (status)
#
FactoryBot.define do
  factory :ad do
    association :ad_group

    status { "draft" }
  end
end
