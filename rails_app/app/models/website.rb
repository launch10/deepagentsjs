# == Schema Information
#
# Table name: websites
#
#  id          :bigint           not null, primary key
#  deleted_at  :datetime
#  name        :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  account_id  :bigint
#  project_id  :bigint
#  template_id :bigint
#  theme_id    :integer
#
# Indexes
#
#  index_websites_on_account_id   (account_id)
#  index_websites_on_created_at   (created_at)
#  index_websites_on_deleted_at   (deleted_at)
#  index_websites_on_name         (name)
#  index_websites_on_project_id   (project_id)
#  index_websites_on_template_id  (template_id)
#  index_websites_on_theme_id     (theme_id)
#

class Website < ApplicationRecord
  include Historiographer::Safe
  include Atlas::Website
  include WebsiteConcerns::ShasumHashable
  include WebsiteConcerns::FileManagement
  include WebsiteConcerns::ThemeCssInjection
  include ChatCreatable
  historiographer_mode :snapshot_only
  acts_as_paranoid
  acts_as_tenant :account

  belongs_to :project
  has_one :brainstorm, dependent: :destroy
  belongs_to :account

  def self.chat_type
    "website"
  end
  belongs_to :template
  belongs_to :theme, optional: true

  has_many :website_files, dependent: :destroy, class_name: "WebsiteFile"
  has_many :template_files, through: :template, source: :files
  has_many :code_files
  alias_method :files, :code_files
  has_many :domains, dependent: :destroy
  has_many :website_urls, dependent: :destroy
  alias_method :urls, :website_urls
  has_many :deploys, class_name: "WebsiteDeploy", dependent: :destroy

  has_many :website_uploads
  has_many :uploads, -> { order(:id) }, through: :website_uploads
  has_many :campaigns
  alias_method :ad_campaigns, :campaigns
  has_many :visits, class_name: "Ahoy::Visit"
  has_many :website_leads, dependent: :destroy
  has_many :leads, through: :website_leads

  accepts_nested_attributes_for :website_files, allow_destroy: true

  validates_presence_of :name, :project_id, :account_id, :template
  before_validation :set_default_template
  before_validation :set_default_theme

  def build
    deploy = deploys.create!
    deploy.build!
  end

  def deploy(async: true, environment: nil)
    env = environment || default_environment
    deploy_record = deploys.create!(environment: env, is_preview: false)
    deploy_record.deploy(async: async)
  end

  def deploy!(async: true, environment: nil)
    deploy(async: async, environment: environment)
  end

  def preview(async: true, environment: nil)
    env = environment || default_environment
    deploy_record = deploys.create!(environment: env, is_preview: true)
    deploy_record.deploy(async: async)
  end

  def preview!(async: true, environment: nil)
    preview(async: async, environment: environment)
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
    deploys.revertible.where("id < ?", current_live.id).order(id: :desc).limit(1).first
  end

  # Get the primary domain for this website
  def domain
    domains.first&.domain || name
  end

  # Creates website_files from the fixture
  def make_fixture_files
    website_files.destroy_all

    fixture_files = JSON.parse(File.read(Rails.root.join("spec/fixtures/valid_website_files.json")))

    fixture_files.each do |file_data|
      website_files.create!(
        path: file_data["path"],
        content: file_data["content"]
      )
    end
  end

  def files_from_snapshot(snapshot_id = nil)
    snapshot = snapshot_id ? snapshots.find_by(snapshot_id: snapshot_id) : latest_snapshot
    return CodeFileHistory.none unless snapshot.is_a?(WebsiteHistory)

    CodeFileHistory.for_website(id).for_snapshot(snapshot.snapshot_id)
  end

  def sync_all_to_atlas
    account.sync_to_atlas
    domains.each { |d| d.sync_to_atlas }
    website_urls.each { |wu| wu.sync_to_atlas }
    account.plan.sync_to_atlas
    sync_to_atlas
  end

  private

  def default_environment
    if Rails.env.production?
      "production"
    elsif Rails.env.staging?
      "staging"
    else
      Cloudflare.deploy_env || "development"
    end
  end

  def set_default_template
    self.template = Template.first if template.nil?
  end

  def set_default_theme
    self.theme = Theme.order(id: :asc).first if theme.nil?
  end
end
