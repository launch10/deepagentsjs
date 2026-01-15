# == Schema Information
#
# Table name: job_runs
#
#  id                  :bigint           not null, primary key
#  completed_at        :datetime
#  error_message       :text
#  job_args            :jsonb
#  job_class           :string           not null
#  result_data         :jsonb
#  started_at          :datetime
#  status              :string           default("pending"), not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  account_id          :bigint
#  deploy_id           :bigint
#  langgraph_thread_id :string
#
# Indexes
#
#  index_job_runs_on_account_id            (account_id)
#  index_job_runs_on_deploy_id             (deploy_id)
#  index_job_runs_on_job_class             (job_class)
#  index_job_runs_on_job_class_and_status  (job_class,status)
#  index_job_runs_on_langgraph_thread_id   (langgraph_thread_id)
#  index_job_runs_on_status                (status)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#
class JobRun < ApplicationRecord
  belongs_to :account
  belongs_to :deploy, optional: true

  STATUSES = %w[pending running completed failed].freeze
  ALLOWED_JOBS = %w[CampaignDeploy WebsiteDeploy GoogleOAuthConnect GoogleAdsInvite].freeze

  validates :job_class, presence: true, inclusion: { in: ALLOWED_JOBS }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :account, presence: true

  scope :pending, -> { where(status: "pending") }
  scope :running, -> { where(status: "running") }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :for_job, ->(job_class) { where(job_class: job_class) }
  scope :recent, -> { order(created_at: :desc) }

  # Create a job run for tracking purposes (non-Langgraph usage)
  # For Langgraph-triggered jobs, use the API endpoint instead
  def self.create_for(job_class, args = {})
    create!(
      job_class: job_class.to_s,
      status: "pending",
      job_args: args,
      account: Current.account
    )
  end

  def start!
    update!(status: "running", started_at: Time.current)
  end

  def complete!(result = nil)
    update!(
      status: "completed",
      result_data: result,
      completed_at: Time.current
    )
  end

  def fail!(error)
    update!(
      status: "failed",
      error_message: error.is_a?(Exception) ? "#{error.class}: #{error.message}" : error.to_s,
      completed_at: Time.current
    )
  end

  # Enqueues async webhook delivery - no bang since it doesn't raise
  def notify_langgraph(status:, result: nil, error: nil)
    return unless langgraph_thread_id.present? && langgraph_callback_url.present?

    LanggraphCallbackWorker.perform_async(id, callback_payload(status, result, error))
  end

  def langgraph_callback_url
    base_url = ENV["LANGGRAPH_API_URL"]
    return nil if base_url.blank?

    "#{base_url}/webhooks/job_run_callback"
  end

  def pending? = status == "pending"

  def running? = status == "running"

  def completed? = status == "completed"

  def failed? = status == "failed"

  def finished? = completed? || failed?

  def duration
    return nil unless started_at && completed_at
    completed_at - started_at
  end

  private

  def callback_payload(status, result, error)
    {
      job_run_id: id,
      thread_id: langgraph_thread_id,
      status: status,
      result: result,
      error: error
    }
  end
end
