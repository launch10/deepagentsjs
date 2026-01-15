# == Schema Information
#
# Table name: projects
#
#  id         :bigint           not null, primary key
#  name       :string           not null
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
#  index_projects_on_account_id_and_updated_at  (account_id,updated_at)
#  index_projects_on_created_at                 (created_at)
#  index_projects_on_name                       (name)
#  index_projects_on_updated_at                 (updated_at)
#  index_projects_on_uuid                       (uuid) UNIQUE
#

class Project < ApplicationRecord
  include ProjectConcerns::Serialization

  acts_as_tenant :account

  belongs_to :account
  validates :name, presence: true
  validates :account_id, presence: true
  before_validation :set_uuid, on: :create

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

  private

  def set_uuid
    return if uuid.present?

    self.uuid = UUID7.generate
  end
end
