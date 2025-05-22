# == Schema Information
#
# Table name: pages
#
#  id         :integer          not null, primary key
#  name       :string
#  project_id :integer          not null
#  file_id    :integer          not null
#  page_type  :string           not null
#  plan       :jsonb            default("{}")
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_pages_on_created_at                (created_at)
#  index_pages_on_file_id                   (file_id)
#  index_pages_on_project_id                (project_id)
#  index_pages_on_project_id_and_page_type  (project_id,page_type)
#

class Page < ApplicationRecord
end
