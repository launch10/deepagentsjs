# == Schema Information
#
# Table name: deploys
#
#  id                 :bigint           not null, primary key
#  active             :boolean          default(TRUE), not null
#  current_step       :string
#  deleted_at         :datetime
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
  acts_as_paranoid

  STATUS = %w[pending running completed failed].freeze

  belongs_to :project
  has_one :website, through: :project
  belongs_to :website_deploy, class_name: "WebsiteDeploy", optional: true
  belongs_to :campaign_deploy, optional: true
  has_many :job_runs, dependent: :nullify
  has_one :chat, as: :contextable
  has_one :support_request, as: :supportable, dependent: :nullify

  validates :status, presence: true, inclusion: { in: STATUS }

  attr_accessor :needs_support

  before_create :set_thread_id
  before_create :deactivate_previous_deploy!
  after_create :create_deploy_chat!
  before_destroy :deactivate!
  after_save :refresh_project_status, if: :saved_change_to_is_live?
  after_save :auto_create_support_ticket,
    if: -> { saved_change_to_status? && status == "failed" && needs_support }

  scope :active, -> { where(active: true) }
  scope :latest, -> { order(created_at: :desc).limit(1).last }
  scope :live, -> { where(is_live: true) }
  scope :in_progress, -> { where(status: %w[pending running]) }
  scope :user_recently_active, -> { where(user_active_at: 5.minutes.ago..) }

  def touch_user_active!
    update_column(:user_active_at, Time.current)
  end

  def deactivate!
    update_column(:active, false)
    chat&.update!(active: false)
    true
  end

  private

  def set_thread_id
    self.thread_id ||= SecureRandom.uuid
  end

  def deactivate_previous_deploy!
    project.deploys.where(active: true).where.not(id: id).update_all(active: false)
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
end
