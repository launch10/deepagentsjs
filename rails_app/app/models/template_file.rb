# == Schema Information
#
# Table name: template_files
#
#  id          :bigint           not null, primary key
#  content     :text
#  content_tsv :tsvector
#  embedding   :vector(1536)
#  path        :string
#  shasum      :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  template_id :bigint
#
# Indexes
#
#  idx_template_files_content_tsv                (content_tsv) USING gin
#  idx_template_files_embedding                  (embedding) USING ivfflat
#  idx_template_files_path_trgm                  (path) USING gin
#  index_template_files_on_path                  (path)
#  index_template_files_on_shasum                (shasum)
#  index_template_files_on_template_id           (template_id)
#  index_template_files_on_template_id_and_path  (template_id,path) UNIQUE
#

class TemplateFile < ApplicationRecord
  include Embeddable

  belongs_to :template

  include FileConcerns::Setters
  include FileConcerns::ShasumHashable
  include FileConcerns::Serialization
end
