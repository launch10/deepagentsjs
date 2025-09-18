# == Schema Information
#
# Table name: page_plans
#
#  id          :integer          not null, primary key
#  website_id  :integer
#  page_type   :string
#  description :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#
# Indexes
#
#  index_page_plans_on_created_at  (created_at)
#  index_page_plans_on_page_type   (page_type)
#  index_page_plans_on_website_id  (website_id)
#

class PagePlan < ApplicationRecord
  belongs_to :website
end
