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
#  thread_id  :string
#
# Indexes
#
#  index_websites_on_created_at  (created_at)
#  index_websites_on_name        (name)
#  index_websites_on_project_id  (project_id)
#  index_websites_on_thread_id   (thread_id) UNIQUE
#  index_websites_on_user_id     (user_id)
#

class Website < ApplicationRecord
  include Historiographer::Safe
  historiographer_mode :snapshot_only

  belongs_to :project
  belongs_to :user

  has_many :files, dependent: :destroy, class_name: "WebsiteFile"
  has_many :domains, dependent: :destroy
  has_many :deploys, dependent: :destroy
  accepts_nested_attributes_for :files

  validates_presence_of :name, :project_id, :user_id, :thread_id

  def files_from_snapshot(snapshot_id = nil)
    snapshot = snapshot_id ? snapshots.find(snapshot_id) : latest_snapshot
    snapshot.files
  end

  def build
    deploy = deploys.create!
    deploy.build!
  end

  def deploy!
    deploy = deploys.create!
    deploy.deploy!
  end
end