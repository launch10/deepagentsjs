# == Schema Information
#
# Table name: ad_structured_snippets
#
#  id          :bigint           not null, primary key
#  category    :string           not null
#  values      :jsonb            not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  campaign_id :bigint           not null
#
# Indexes
#
#  index_ad_structured_snippets_on_campaign_id  (campaign_id)
#  index_ad_structured_snippets_on_category     (category)
#  index_ad_structured_snippets_on_created_at   (created_at)
#
class AdStructuredSnippet < ApplicationRecord
  include AdStructuredSnippetConcerns::Categories

  belongs_to :campaign

  validates :category, presence: true
end
