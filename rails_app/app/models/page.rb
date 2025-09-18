# == Schema Information
#
# Table name: pages
#
#  id                    :integer          not null, primary key
#  name                  :string
#  page_type             :string           not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  website_id            :integer
#  website_file_id       :integer
#  path                  :string
#  file_specification_id :integer
#
# Indexes
#
#  index_pages_on_created_at             (created_at)
#  index_pages_on_file_specification_id  (file_specification_id)
#  index_pages_on_path                   (path)
#  index_pages_on_website_file_id        (website_file_id)
#  index_pages_on_website_id             (website_id)
#

class Page < ApplicationRecord
end
