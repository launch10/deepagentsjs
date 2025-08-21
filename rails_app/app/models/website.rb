# == Schema Information
#
# Table name: websites
#
#  id         :integer          not null, primary key
#  name       :string
#  project_id :integer
#  user_id    :integer
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_websites_on_created_at  (created_at)
#  index_websites_on_name        (name)
#  index_websites_on_project_id  (project_id)
#  index_websites_on_user_id     (user_id)
#

class Website < ApplicationRecord
  belongs_to :project
  belongs_to :user

  has_many :files, dependent: :destroy, class_name: "WebsiteFile"
  accepts_nested_attributes_for :files
end