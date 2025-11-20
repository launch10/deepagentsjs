# == Schema Information
#
# Table name: content_strategies
#
#  id                    :bigint           not null, primary key
#  attention_grabber     :string
#  audience              :string
#  call_to_action        :string
#  core_emotional_driver :string
#  emotional_bridge      :string
#  landing_page_copy     :text
#  page_mood             :string
#  problem_statement     :string
#  product_reveal        :string
#  social_proof          :string
#  summary               :text
#  tone                  :string           not null
#  urgency_hook          :string
#  visual_evocation      :string
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  website_id            :integer
#
# Indexes
#
#  index_content_strategies_on_created_at  (created_at)
#  index_content_strategies_on_updated_at  (updated_at)
#  index_content_strategies_on_website_id  (website_id)
#

class ContentStrategy < ApplicationRecord
  belongs_to :website
end
