# == Schema Information
#
# Table name: deploys
#
#  id                 :bigint           not null, primary key
#  active             :boolean          default(TRUE), not null
#  current_step       :string
#  deleted_at         :datetime
#  deploy_type        :string           default("website"), not null
#  finished_at        :datetime
#  is_live            :boolean          default(FALSE)
#  stacktrace         :text
#  status             :string           default("pending"), not null
#  user_active_at     :datetime
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  campaign_deploy_id :bigint
#  project_id         :bigint           not null
#  thread_id          :string           not null
#  website_deploy_id  :bigint
#
# Indexes
#
#  index_deploys_on_active_project          (project_id,active) UNIQUE WHERE ((deleted_at IS NULL) AND (active = true))
#  index_deploys_on_campaign_deploy_id      (campaign_deploy_id)
#  index_deploys_on_deleted_at              (deleted_at)
#  index_deploys_on_deploy_type             (deploy_type)
#  index_deploys_on_finished_at             (finished_at)
#  index_deploys_on_is_live                 (is_live)
#  index_deploys_on_project_id              (project_id)
#  index_deploys_on_project_id_and_is_live  (project_id,is_live)
#  index_deploys_on_project_id_and_status   (project_id,status)
#  index_deploys_on_status                  (status)
#  index_deploys_on_thread_id               (thread_id)
#  index_deploys_on_website_deploy_id       (website_deploy_id)
#
# Foreign Keys
#
#  fk_rails_...  (campaign_deploy_id => campaign_deploys.id)
#  fk_rails_...  (project_id => projects.id)
#  fk_rails_...  (website_deploy_id => website_deploys.id)
#
class Deploy < ApplicationRecord
  include Langgraph::ThreadAccessible

  acts_as_paranoid

  STATUS = %w[pending running completed failed].freeze
  DEPLOY_TYPES = %w[website campaign].freeze

  belongs_to :project
  has_one :website, through: :project
  belongs_to :website_deploy, class_name: "WebsiteDeploy", optional: true
  belongs_to :campaign_deploy, optional: true
  has_many :job_runs, dependent: :nullify
  has_one :chat, as: :contextable
  has_one :support_request, as: :supportable, dependent: :nullify

  validates :status, presence: true, inclusion: { in: STATUS }
  validates :deploy_type, presence: true, inclusion: { in: DEPLOY_TYPES }

  attr_accessor :needs_support

  before_create :set_thread_id
  before_create :deactivate_previous_deploy!
  after_create :create_deploy_chat!
  before_destroy :deactivate!
  after_save :refresh_project_status, if: :saved_change_to_is_live?
  after_save :auto_create_support_ticket,
    if: -> { saved_change_to_status? && status == "failed" && needs_support }
  before_save :stamp_finished_at,
    if: -> { status_changed? && status.in?(%w[completed failed]) }

  scope :active, -> { where(active: true) }
  scope :latest, -> { order(created_at: :desc).limit(1).last }
  scope :live, -> { where(is_live: true) }
  scope :in_progress, -> { where(status: %w[pending running]) }
  scope :user_recently_active, -> { where(user_active_at: 5.minutes.ago..) }
  scope :slow, ->(threshold = 5.minutes) {
    where.not(finished_at: nil).where("finished_at - created_at > ?", threshold)
  }
  scope :completed, -> { where(status: "completed") }
  scope :stuck, -> { in_progress.where("created_at < ?", 15.minutes.ago) }
  # Find the current active deploy for a given target.
  # :website matches both "website" and "campaign" (both deploy website).
  # :google_ads matches only "campaign".
  scope :current_for, ->(target) {
    scope = active.order(id: :desc)
    (target.to_s == "google_ads") ? scope.where(deploy_type: "campaign") : scope
  }

  def self.ever_completed_with_deploy_type?(project, deploy_type)
    project.deploys.completed.where(deploy_type: deploy_type).exists?
  end

  def website_only?
    deploy_type == "website"
  end

  def includes_campaign?
    deploy_type == "campaign"
  end

  # Returns instructions hash for API compatibility with Langgraph
  def instructions
    if deploy_type == "campaign"
      { "website" => true, "googleAds" => true }
    else
      { "website" => true }
    end
  end

  def touch_user_active!
    update_column(:user_active_at, Time.current)
  end

  # Duration in seconds, or nil if not yet finished
  def duration
    return nil unless finished_at

    finished_at - created_at
  end

  def deactivate!
    cancel_in_progress! if status.in?(%w[pending running])
    update_column(:active, false)
    chat&.update!(active: false)
    true
  end

  def cancel_in_progress!
    return unless status.in?(%w[pending running])

    transaction do
      update!(status: "failed", stacktrace: "Superseded by newer deploy")

      # Fail all pending/running job_runs so Sidekiq retries stop notifying Langgraph
      job_runs.where(status: %w[pending running]).find_each do |jr|
        jr.fail!("Deploy superseded by newer deploy")
      end

      # Skip the website_deploy if it hasn't completed
      if website_deploy&.status&.in?(%w[pending building uploading])
        website_deploy.update!(status: "skipped")
      end
    end
  end

  private

  def set_thread_id
    self.thread_id ||= SecureRandom.uuid
  end

  def deactivate_previous_deploy!
    previous_deploys = project.deploys.where(active: true).where.not(id: id)

    # Cancel any in-progress deploys -- not just deactivate
    previous_deploys.in_progress.find_each do |old_deploy|
      old_deploy.cancel_in_progress!
    end

    previous_deploys.update_all(active: false)
  end

  def create_deploy_chat!
    project.chats.where(chat_type: "deploy", active: true).update_all(active: false)

    create_chat!(
      project: project,
      account: project.account,
      chat_type: "deploy",
      thread_id: thread_id,
      name: "Deploy"
    )
  end

  def refresh_project_status
    project.refresh_status!
  end

  def auto_create_support_ticket
    Deploys::AutoSupportTicketService.new(self).call
  end

  def stamp_finished_at
    self.finished_at ||= Time.current
  end
end
