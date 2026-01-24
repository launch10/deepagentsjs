# == Schema Information
#
# Table name: llm_usage
#
#  id                      :bigint           not null, primary key
#  cache_creation_tokens   :integer          default(0)
#  cache_read_tokens       :integer          default(0)
#  cost_microcents         :bigint
#  graph_name              :string
#  input_tokens            :integer          default(0), not null
#  metadata                :jsonb
#  model_raw               :string           not null
#  output_tokens           :integer          default(0), not null
#  processed_at            :datetime
#  reasoning_tokens        :integer          default(0)
#  tags                    :string           default([]), is an Array
#  created_at              :datetime         not null
#  updated_at              :datetime         not null
#  chat_id                 :bigint           not null
#  langchain_run_id        :string
#  message_id              :string
#  parent_langchain_run_id :string
#  run_id                  :string           not null
#  thread_id               :string           not null
#
# Indexes
#
#  index_llm_usage_on_chat_id_and_run_id           (chat_id,run_id)
#  index_llm_usage_on_processed_at_and_created_at  (processed_at,created_at)
#  index_llm_usage_on_run_id                       (run_id)
#  index_llm_usage_on_thread_id_and_created_at     (thread_id,created_at)
#
class LLMUsage < ApplicationRecord
  self.table_name = "llm_usage"

  belongs_to :chat, optional: true

  validates :thread_id, presence: true
  validates :run_id, presence: true
  validates :model_raw, presence: true

  scope :unprocessed, -> { where(processed_at: nil) }
  scope :for_run, ->(run_id) { where(run_id: run_id) }
  scope :for_thread, ->(thread_id) { where(thread_id: thread_id) }

  def processed?
    processed_at.present?
  end

  def total_tokens
    input_tokens + output_tokens + reasoning_tokens + cache_creation_tokens + cache_read_tokens
  end
end
