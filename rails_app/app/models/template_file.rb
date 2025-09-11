# == Schema Information
#
# Table name: template_files
#
#  id                    :integer          not null, primary key
#  template_id           :integer
#  path                  :string
#  content               :text
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  shasum                :string
#  file_specification_id :integer
#  content_tsv           :tsvector
#
# Indexes
#
#  idx_template_files_content_tsv                 (content_tsv)
#  idx_template_files_path_trgm                   (path)
#  index_template_files_on_file_specification_id  (file_specification_id)
#  index_template_files_on_path                   (path)
#  index_template_files_on_shasum                 (shasum)
#  index_template_files_on_template_id            (template_id)
#  index_template_files_on_template_id_and_path   (template_id,path) UNIQUE
#

class TemplateFile < ApplicationRecord
  belongs_to :template

  include FileConcerns::Setters
  include FileConcerns::ShasumHashable
  include FileConcerns::Serialization
end
