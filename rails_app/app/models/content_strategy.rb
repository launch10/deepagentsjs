# == Schema Information
#
# Table name: content_strategies
#
#  id                    :integer          not null, primary key
#  tone                  :string           not null
#  core_emotional_driver :string
#  attention_grabber     :string
#  problem_statement     :string
#  emotional_bridge      :string
#  product_reveal        :string
#  social_proof          :string
#  urgency_hook          :string
#  call_to_action        :string
#  page_mood             :string
#  visual_evocation      :string
#  landing_page_copy     :text
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  website_id            :integer
#  summary               :text
#  audience              :string
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
