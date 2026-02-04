# == Schema Information
#
# Table name: agent_context_events
#
#  id             :bigint           not null, primary key
#  account_id     :bigint           not null
#  project_id     :bigint
#  user_id        :bigint
#  eventable_type :string
#  eventable_id   :bigint
#  event_type     :string           not null
#  payload        :jsonb            default({})
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#
# Indexes
#
#  index_agent_context_events_on_account_id                      (account_id)
#  index_agent_context_events_on_event_type                      (event_type)
#  index_agent_context_events_on_eventable_type_and_eventable_id (eventable_type, eventable_id)
#  index_agent_context_events_on_project_id_and_created_at       (project_id, created_at)
#
class AgentContextEvent < ApplicationRecord
  acts_as_tenant :account

  belongs_to :account
  belongs_to :project, optional: true
  belongs_to :user, optional: true
  belongs_to :eventable, polymorphic: true, optional: true

  # Valid verbs per context-engineering/PLAN.md
  VALID_VERBS = %w[created updated deleted assigned unassigned completed paused resumed].freeze

  # Valid event types for MVP (images only initially)
  VALID_EVENT_TYPES = %w[
    images.created
    images.deleted
  ].freeze

  validates :event_type, presence: true
  validates :event_type, format: {
    with: /\A[a-z_]+\.(#{VALID_VERBS.join("|")})\z/,
    message: "must be in format 'resource.verb'"
  }, allow_blank: true
  validates :event_type, inclusion: { in: VALID_EVENT_TYPES }, allow_blank: true

  scope :since, ->(time) { time.present? ? where("created_at > ?", time) : all }
  scope :for_project, ->(project_id) { where(project_id: project_id) }
  scope :of_types, ->(types) { types.present? ? where(event_type: Array(types)) : all }
  scope :chronological, -> { order(created_at: :asc) }
end
