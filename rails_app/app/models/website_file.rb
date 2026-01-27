# == Schema Information
#
# Table name: website_files
#
#  id          :bigint           not null, primary key
#  content     :string           not null
#  content_tsv :tsvector
#  path        :string           not null
#  shasum      :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  website_id  :bigint           not null
#
# Indexes
#
#  idx_website_files_content_tsv                      (content_tsv) USING gin
#  idx_website_files_path_trgm                        (path) USING gin
#  index_website_files_on_created_at                  (created_at)
#  index_website_files_on_shasum                      (shasum)
#  index_website_files_on_updated_at                  (updated_at)
#  index_website_files_on_website_id                  (website_id)
#  index_website_files_on_website_id_and_path_unique  (website_id,path) UNIQUE
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
