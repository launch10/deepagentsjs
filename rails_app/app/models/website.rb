# == Schema Information
#
# Table name: websites
#
#  id          :integer          not null, primary key
#  name        :string
#  project_id  :integer
#  user_id     :integer
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  thread_id   :string
#  template_id :integer
#
# Indexes
#
#  index_websites_on_created_at   (created_at)
#  index_websites_on_name         (name)
#  index_websites_on_project_id   (project_id)
#  index_websites_on_template_id  (template_id)
#  index_websites_on_thread_id    (thread_id) UNIQUE
#  index_websites_on_user_id      (user_id)
#

class Website < ApplicationRecord
  include Historiographer::Safe
  include AtlasSyncable
  historiographer_mode :snapshot_only

  belongs_to :project
  belongs_to :user
  belongs_to :template, optional: true

  has_many :website_files, dependent: :destroy, class_name: "WebsiteFile"
  has_many :template_files, through: :template, source: :files
  has_many :domains, dependent: :destroy
  has_many :deploys, dependent: :destroy
  
  accepts_nested_attributes_for :website_files

  validates_presence_of :name, :project_id, :user_id

  # Returns the merged set of template_files + website_files
  # Website files override template files with the same path
  def files
    return website_files unless template.present?
    
    template_files_by_path = template_files.index_by(&:path)
    website_files_by_path = website_files.index_by(&:path)
    
    # Merge, with website files taking precedence
    all_paths = (template_files_by_path.keys + website_files_by_path.keys).uniq
    all_paths.map do |path|
      website_files_by_path[path] || template_files_by_path[path]
    end
  end
  
  def build
    deploy = deploys.create!
    deploy.build!
  end

  def deploy!
    deploy = deploys.create!
    deploy.deploy!
  end

  # Creates website_files from the fixture
  def make_fixture_files
    fixture_files = JSON.parse(File.read(Rails.root.join('spec/fixtures/valid_website_files.json')))
    
    fixture_files.each do |file_data|
      website_files.create!(
        path: file_data['path'],
        content: file_data['content']
      )
    end
  end
  
  def files_from_snapshot(snapshot_id = nil)
    snapshot = snapshot_id ? snapshots.find(snapshot_id) : latest_snapshot
    snapshot.files
  end

  private

  # Atlas sync methods
  def atlas_service
    Atlas.websites
  end

  def atlas_data_for_create
    {
      id: id,
      user_id: user.id
    }
  end

  def atlas_data_for_update
    {
      user_id: user.id
    }
  end

  def sync_to_atlas_required?
    # Only sync if user_id changes (unlikely but possible)
    saved_change_to_user_id?
  end

  def atlas_identifier
    id
  end
end
