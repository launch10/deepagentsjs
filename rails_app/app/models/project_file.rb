# == Schema Information
#
# Table name: project_files
#
#  id                    :integer          not null, primary key
#  project_id            :integer          not null
#  file_specification_id :integer
#  path                  :string           not null
#  content               :string           not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
# Indexes
#
#  index_project_files_on_created_at             (created_at)
#  index_project_files_on_file_specification_id  (file_specification_id)
#  index_project_files_on_project_id             (project_id)
#  index_project_files_on_updated_at             (updated_at)
#

class ProjectFile < ApplicationRecord
  belongs_to :project, inverse_of: :files

  include FileSerialization
  include FileSetters
end
