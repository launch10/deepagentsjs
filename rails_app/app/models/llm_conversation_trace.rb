# == Schema Information
#
# Table name: llm_conversation_traces
#
#  id            :bigint           not null, primary key
#  graph_name    :string
#  llm_calls     :jsonb
#  messages      :jsonb            not null
#  system_prompt :text
#  usage_summary :jsonb
#  created_at    :datetime         not null, primary key
#  chat_id       :bigint           not null
#  run_id        :string           not null
#  thread_id     :string           not null
#
# Indexes
#
#  llm_conversation_traces_chat_id_created_at_idx    (chat_id,created_at)
#  llm_conversation_traces_run_id_created_at_idx     (run_id,created_at) UNIQUE
#  llm_conversation_traces_thread_id_created_at_idx  (thread_id,created_at)
#
class LLMConversationTrace < ApplicationRecord
  belongs_to :chat, optional: true

  validates :thread_id, presence: true
  validates :run_id, presence: true
  validates :messages, presence: true

  scope :for_thread, ->(thread_id) { where(thread_id: thread_id) }
  scope :for_chat, ->(chat) { where(chat: chat) }
  scope :recent, -> { order(created_at: :desc) }

  def llm_call_count
    llm_calls&.count || 0
  end

  def total_cost_cents
    (usage_summary&.dig("total_cost_microcents") || 0) / 10_000.0
  end
end
