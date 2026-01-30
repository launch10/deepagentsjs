# == Schema Information
#
# Table name: projects
#
#  id         :bigint           not null, primary key
#  deleted_at :datetime
#  name       :string           not null
#  status     :string           default("draft"), not null
#  uuid       :uuid             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint           not null
#
# Indexes
#
#  index_projects_on_account_id                 (account_id)
#  index_projects_on_account_id_and_created_at  (account_id,created_at)
#  index_projects_on_account_id_and_name        (account_id,name) UNIQUE
#  index_projects_on_account_id_and_status      (account_id,status)
#  index_projects_on_account_id_and_updated_at  (account_id,updated_at)
#  index_projects_on_created_at                 (created_at)
#  index_projects_on_deleted_at                 (deleted_at)
#  index_projects_on_name                       (name)
#  index_projects_on_status                     (status)
#  index_projects_on_updated_at                 (updated_at)
#  index_projects_on_uuid                       (uuid) UNIQUE
#

class Project < ApplicationRecord
  include ProjectConcerns::Leads
  include ProjectConcerns::Serialization
  acts_as_paranoid

  acts_as_tenant :account

  STATUSES = %w[draft paused live].freeze

  belongs_to :account
  validates :name, presence: true
  validates :account_id, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }
  before_validation :set_uuid, on: :create
  before_destroy :log_deletion

  has_one :website
  has_one :ads_account, through: :account
  has_one :brainstorm, through: :website
  # Leads are now account-scoped via website_leads join table
  # Access via: project.website.leads
  has_many :workflows, class_name: "ProjectWorkflow", dependent: :destroy
  has_one :launch_workflow, -> { where(workflow_type: "launch") }, class_name: "ProjectWorkflow"
  has_many :chats
  has_many :social_links, dependent: :destroy
  has_many :uploads, through: :website

  # Ads relations
  has_many :campaigns
  has_many :ad_groups, through: :campaigns
  has_many :ads, through: :ad_groups
  has_many :ad_schedules, through: :campaigns
  has_many :languages, through: :campaigns
  has_many :headlines, through: :campaigns
  has_many :descriptions, through: :campaigns
  has_many :keywords, through: :ad_groups
  has_many :location_targets, through: :campaigns
  has_many :callouts, through: :campaigns
  has_many :structured_snippets, through: :campaigns

  # Deploy tracking
  has_many :deploys, dependent: :destroy

  # Analytics
  has_many :analytics_daily_metrics, dependent: :destroy

  def self.with_launch_relations
    Project.includes(
      :brainstorm,
      :launch_workflow,
      :website,
      :ads_account,
      campaigns: [
        :languages,
        :keywords,
        :location_targets,
        :callouts,
        :structured_snippet,
        :ad_schedules,
        { ad_groups: { ads: [:headlines, :descriptions] } }
      ]
    )
  end

  # TODO: Add more logic when we have other workflows user could be in
  def current_workflow
    launch_workflow
  end

  def step
    current_workflow.step
  end

  def substep
    current_workflow.substep
  end

  def current_chat
    current_workflow.chat
  end

  # Returns the active deploy for this project.
  # Prioritizes in-progress deploys, falls back to most recent.
  def active_deploy
    deploys.in_progress.order(created_at: :desc).first ||
      deploys.order(created_at: :desc).first
  end

  # Returns the most recent live deploy for this project.
  def live_deploy
    deploys.live.order(created_at: :desc).first
  end

  def open
    url = Rails.application.routes.url_helpers.project_url(uuid, host: ENV.fetch("APP_HOST", "localhost:3000"))
    Launchy.open(url)
  end

  # Generate a signed token for lead capture authentication.
  # Uses Rails signed_id for stateless, tamper-proof authentication.
  def signup_token
    signed_id(purpose: :lead_signup)
  end

  # Recalculates and persists the project status based on deploys and campaigns.
  # Status priority: live > paused > draft
  #   - "live" if any deploy is live
  #   - "paused" if any campaign is paused
  #   - "draft" otherwise
  def refresh_status!
    new_status = compute_status
    update_column(:status, new_status) if status != new_status
    new_status
  end

  def live?
    status == "live"
  end

  def paused?
    status == "paused"
  end

  def draft?
    status == "draft"
  end

  private

  def compute_status
    if campaigns.where(status: "paused").exists?
      "paused"
    elsif deploys.live.exists?
      "live"
    else
      "draft"
    end
  end

  def set_uuid
    return if uuid.present?

    self.uuid = UUID7.generate
  end

  def log_deletion
    Rails.logger.warn "=" * 80
    Rails.logger.warn "PROJECT DELETION DETECTED"
    Rails.logger.warn "Project ID: #{id}, UUID: #{uuid}, Name: #{name}"
    Rails.logger.warn "Account ID: #{account_id}"
    Rails.logger.warn "Backtrace:"
    caller.first(20).each { |line| Rails.logger.warn "  #{line}" }
    Rails.logger.warn "=" * 80
  end
end
