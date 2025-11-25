# == Schema Information
#
# Table name: keywords
#
#  id          :bigint           not null, primary key
#  match_type  :string           default("broad"), not null
#  position    :integer          not null
#  text        :string(120)      not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  ad_group_id :bigint           not null
#
# Indexes
#
#  index_keywords_on_ad_group_id  (ad_group_id)
#  index_keywords_on_created_at   (created_at)
#  index_keywords_on_match_type   (match_type)
#  index_keywords_on_position     (position)
#  index_keywords_on_text         (text)
#
class AdKeyword < ApplicationRecord
  belongs_to :ad_group, class_name: "AdGroup", inverse_of: :keywords
end