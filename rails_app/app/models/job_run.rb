# == Schema Information
#
# Table name: job_runs
#
#  id            :bigint           not null, primary key
#  completed_at  :datetime
#  error_message :text
#  job_args      :jsonb
#  job_class     :string           not null
#  started_at    :datetime
#  status        :string           default("pending"), not null
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#
# Indexes
#
#  index_job_runs_on_job_class             (job_class)
#  index_job_runs_on_job_class_and_status  (job_class,status)
#  index_job_runs_on_status                (status)
#
class JobRun < ApplicationRecord
  STATUSES = %w[pending running completed failed].freeze

  validates :job_class, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  scope :pending, -> { where(status: "pending") }
  scope :running, -> { where(status: "running") }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :for_job, ->(job_class) { where(job_class: job_class) }
  scope :recent, -> { order(created_at: :desc) }

  def self.create_for(job_class, args = {})
    create!(
      job_class: job_class.to_s,
      status: "pending",
      job_args: args
    )
  end

  def start!
    update!(status: "running", started_at: Time.current)
  end

  def complete!
    update!(status: "completed", completed_at: Time.current)
  end

  def fail!(error)
    update!(
      status: "failed",
      error_message: error.is_a?(Exception) ? "#{error.class}: #{error.message}" : error.to_s,
      completed_at: Time.current
    )
  end

  def pending?
    status == "pending"
  end

  def running?
    status == "running"
  end

  def completed?
    status == "completed"
  end

  def failed?
    status == "failed"
  end

  def duration
    return nil unless started_at && completed_at
    completed_at - started_at
  end
end
