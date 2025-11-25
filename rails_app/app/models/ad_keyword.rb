# == Schema Information
#
# Table name: ad_keywords
#
#  id                :bigint           not null, primary key
#  match_type        :string           default("broad"), not null
#  platform_settings :jsonb
#  position          :integer          not null
#  text              :string(120)      not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  ad_group_id       :bigint           not null
#
# Indexes
#
#  index_ad_keywords_on_ad_group_id        (ad_group_id)
#  index_ad_keywords_on_created_at         (created_at)
#  index_ad_keywords_on_google_id          (((platform_settings ->> 'google'::text)))
#  index_ad_keywords_on_match_type         (match_type)
#  index_ad_keywords_on_platform_settings  (platform_settings) USING gin
#  index_ad_keywords_on_position           (position)
#  index_ad_keywords_on_text               (text)
#
class AdKeyword < ApplicationRecord
  belongs_to :ad_group, class_name: "AdGroup", inverse_of: :keywords

  validates :text, presence: true, length: { maximum: 80 }
end
