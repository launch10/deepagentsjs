# == Schema Information
#
# Table name: agent_context_events
#
#  id             :bigint           not null, primary key
#  event_type     :string           not null
#  eventable_type :string
#  payload        :jsonb
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  account_id     :bigint           not null
#  eventable_id   :bigint
#  project_id     :bigint
#  user_id        :bigint
#
# Indexes
#
#  index_agent_context_events_on_account_id                       (account_id)
#  index_agent_context_events_on_created_at                       (created_at)
#  index_agent_context_events_on_event_type                       (event_type)
#  index_agent_context_events_on_eventable_type_and_eventable_id  (eventable_type,eventable_id)
#  index_agent_context_events_on_project_id_and_created_at        (project_id,created_at)
#
class AgentContextEvent < ApplicationRecord
  acts_as_tenant :account

  belongs_to :account
  belongs_to :project, optional: true
  belongs_to :user, optional: true
  belongs_to :eventable, polymorphic: true, optional: true

  # Valid verbs per context-engineering/PLAN.md
  VALID_VERBS = %w[created updated deleted assigned unassigned completed paused resumed finished].freeze

  validates :event_type, presence: true
  validates :event_type, format: {
    with: /\A[a-z_]+\.(#{VALID_VERBS.join("|")})\z/,
    message: "must be in format 'resource.verb'"
  }, allow_blank: true
  validate :event_type_in_allowed_list

  # Delegate to shared config for valid event types
  def self.valid_event_types
    AgentContextConfig.valid_event_types
  end

  private

  def event_type_in_allowed_list
    return if event_type.blank?
    return if AgentContextConfig.valid_event_type?(event_type)

    errors.add(:event_type, "is not a valid event type. Valid types: #{AgentContextConfig.valid_event_types.join(", ")}")
  end

  scope :since, ->(time) { time.present? ? where("created_at > ?", time) : all }
  scope :for_project, ->(project_id) { where(project_id: project_id) }
  scope :of_types, ->(types) { types.present? ? where(event_type: Array(types)) : all }
  scope :chronological, -> { order(created_at: :asc) }
end
