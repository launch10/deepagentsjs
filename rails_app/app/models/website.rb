# == Schema Information
#
# Table name: websites
#
#  id          :integer          not null, primary key
#  name        :string
#  project_id  :integer
#  account_id  :integer
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  thread_id   :string
#  template_id :integer
#
# Indexes
#
#  index_websites_on_account_id   (account_id)
#  index_websites_on_created_at   (created_at)
#  index_websites_on_name         (name)
#  index_websites_on_project_id   (project_id)
#  index_websites_on_template_id  (template_id)
#  index_websites_on_thread_id    (thread_id) UNIQUE
#

class Website < ApplicationRecord
  include Historiographer::Safe
  include Atlas::Website
  include WebsiteConcerns::ShasumHashable
  historiographer_mode :snapshot_only

  belongs_to :project
  belongs_to :account
  belongs_to :template

  has_many :website_files, dependent: :destroy, class_name: "WebsiteFile"
  has_many :template_files, through: :template, source: :files
  has_many :domains, dependent: :destroy
  has_many :deploys, dependent: :destroy
  
  accepts_nested_attributes_for :website_files

  validates_presence_of :name, :project_id, :account_id
  before_validation :set_default_template

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

  def deploy(async: true, environment: nil)
    env = environment || default_environment
    deploy_record = deploys.create!(environment: env, is_preview: false)
    deploy_record.deploy(async: async)
  end

  def deploy!(async: true)
    deploy(async: async)
  end

  def preview(async: true, environment: nil)
    env = environment || default_environment
    deploy_record = deploys.create!(environment: env, is_preview: true)
    deploy_record.deploy(async: async)
  end

  def preview!
    preview(async: false)
  end

  def rollback(deploy_id = nil, async: true)
    deploy = deploy_id ? deploys.find(deploy_id) : default_deploy_to_rollback
    raise "No deploy to rollback" unless deploy
    deploy.rollback(async: async)
  end

  def rollback!(deploy_id = nil)
    deploy = deploy_id ? deploys.find(deploy_id) : default_deploy_to_rollback
    raise "No deploy to rollback" unless deploy
    deploy.rollback!
  end

  def default_deploy_to_rollback
    current_live = deploys.live.first
    rollbackable = deploys.revertible.where("id < ?", current_live.id).order(id: :desc).limit(1).first
    rollbackable
  end
  
  # Get the primary domain for this website
  def domain
    domains.first&.domain || name
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

  def default_environment
    if Rails.env.production?
      'production'
    elsif Rails.env.staging?
      'staging'
    else
      'development'
    end
  end

  def set_default_template
    self.template = Template.first if template.nil?
  end

end
