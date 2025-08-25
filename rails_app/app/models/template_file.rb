# == Schema Information
#
# Table name: template_files
#
#  id          :integer          not null, primary key
#  template_id :integer
#  path        :string
#  content     :text
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  shasum      :string
#
# Indexes
#
#  index_template_files_on_path                  (path)
#  index_template_files_on_shasum                (shasum)
#  index_template_files_on_template_id           (template_id)
#  index_template_files_on_template_id_and_path  (template_id,path) UNIQUE
#

class TemplateFile < ApplicationRecord
  belongs_to :template

  include FileConcerns::Setters
  include FileConcerns::ShasumHashable
  include FileConcerns::Serialization
end
