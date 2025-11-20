# == Schema Information
#
# Table name: pages
#
#  id                    :bigint           not null, primary key
#  name                  :string
#  page_type             :string           not null
#  path                  :string
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  file_specification_id :bigint
#  website_file_id       :bigint
#  website_id            :bigint
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
