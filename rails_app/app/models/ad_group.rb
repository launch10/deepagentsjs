# == Schema Information
#
# Table name: ad_groups
#
#  id          :bigint           not null, primary key
#  name        :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  campaign_id :bigint
#
# Indexes
#
#  index_ad_groups_on_campaign_id           (campaign_id)
#  index_ad_groups_on_campaign_id_and_name  (campaign_id,name)
#  index_ad_groups_on_created_at            (created_at)
#  index_ad_groups_on_name                  (name)
#
class AdGroup < ApplicationRecord
  belongs_to :campaign
  has_many :ads, dependent: :destroy
  has_many :keywords, -> { order(position: :asc) }, dependent: :destroy
  has_many :headlines, through: :ads
  has_many :descriptions, through: :ads
  has_many :callouts, dependent: :destroy, class_name: "AdCallout"
  has_one :structured_snippet, dependent: :destroy, class_name: "AdStructuredSnippet"

  validates :name, presence: true

  accepts_nested_attributes_for :ads, allow_destroy: true
  accepts_nested_attributes_for :keywords, allow_destroy: true
end