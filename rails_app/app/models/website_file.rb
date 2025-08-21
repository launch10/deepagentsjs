# == Schema Information
#
# Table name: website_files
#
#  id                    :integer          not null, primary key
#  website_id            :integer          not null
#  file_specification_id :integer
#  path                  :string           not null
#  content               :string           not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
# Indexes
#
#  index_website_files_on_created_at             (created_at)
#  index_website_files_on_file_specification_id  (file_specification_id)
#  index_website_files_on_updated_at             (updated_at)
#  index_website_files_on_website_id             (website_id)
#

class WebsiteFile < ApplicationRecord
  belongs_to :website, inverse_of: :files

  include FileSerialization
  include FileSetters
end
