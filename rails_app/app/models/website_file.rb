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
#  shasum                :string
#  content_tsv           :tsvector
#
# Indexes
#
#  idx_website_files_content_tsv                      (content_tsv)
#  idx_website_files_path_trgm                        (path)
#  index_website_files_on_created_at                  (created_at)
#  index_website_files_on_file_specification_id       (file_specification_id)
#  index_website_files_on_shasum                      (shasum)
#  index_website_files_on_updated_at                  (updated_at)
#  index_website_files_on_website_id                  (website_id)
#  index_website_files_on_website_id_and_path_unique  (website_id,path) UNIQUE
#

# = Schema Information
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
  include Historiographer::Safe
  historiographer_mode :snapshot_only

  belongs_to :website, inverse_of: :website_files

  validates :path, presence: true, uniqueness: {scope: :website_id, message: "already exists for this website"}
  validates :content, presence: true

  include FileConcerns::Setters
  include FileConcerns::ShasumHashable
  include FileConcerns::Serialization
end
