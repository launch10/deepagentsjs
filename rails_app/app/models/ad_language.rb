# == Schema Information
#
# Table name: ad_languages
#
#  id                :bigint           not null, primary key
#  platform_settings :jsonb
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  campaign_id       :bigint
#
# Indexes
#
#  index_ad_languages_on_campaign_id           (campaign_id)
#  index_ad_languages_on_criterion_id          ((((platform_settings -> 'google'::text) ->> 'criterion_id'::text)))
#  index_ad_languages_on_language_constant_id  ((((platform_settings -> 'google'::text) ->> 'language_constant_id'::text)))
#  index_ad_languages_on_platform_settings     (platform_settings) USING gin
#
class AdLanguage < ApplicationRecord
  belongs_to :campaign

  GOOGLE_LANGUAGE_CODES = {
    english: "1000",
    spanish: "1003",
    french: "1005",
    german: "1001",
    italian: "1004",
    dutch: "1010",
    portuguese: "1014",
    japanese: "1005",
    chinese_simplified: "1017",
    chinese_traditional: "1018",
    korean: "1012",
    russian: "1020",
    arabic: "1019"
    # Full list: https://developers.google.com/google-ads/api/reference/data/codes-formats#languages
  }.freeze
end
