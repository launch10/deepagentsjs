# == Schema Information
#
# Table name: ad_descriptions
#
#  id         :bigint           not null, primary key
#  position   :integer          not null
#  text       :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  ad_id      :bigint           not null
#
# Indexes
#
#  index_ad_descriptions_on_ad_id       (ad_id)
#  index_ad_descriptions_on_created_at  (created_at)
#  index_ad_descriptions_on_position    (position)
#
class AdDescription < ApplicationRecord
  belongs_to :campaign, class_name: "Campaign", inverse_of: :descriptions
end
