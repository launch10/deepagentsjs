# == Schema Information
#
# Table name: callouts
#
#  id          :bigint           not null, primary key
#  position    :integer          not null
#  text        :string           not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  ad_group_id :bigint
#  campaign_id :bigint           not null
#
# Indexes
#
#  index_callouts_on_ad_group_id  (ad_group_id)
#  index_callouts_on_campaign_id  (campaign_id)
#  index_callouts_on_created_at   (created_at)
#  index_callouts_on_position     (position)
#
class Callout < ApplicationRecord
  belongs_to :campaign
end
