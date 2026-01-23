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
#
# Indexes
#
#  index_llm_usage_on_chat_id_and_run_id           (chat_id,run_id)
#  index_llm_usage_on_processed_at_and_created_at  (processed_at,created_at)
#  index_llm_usage_on_run_id                       (run_id)
#
FactoryBot.define do
  factory :llm_usage do
    association :chat
    run_id { SecureRandom.uuid }
    message_id { "msg_#{SecureRandom.hex(12)}" }
    langchain_run_id { SecureRandom.uuid }
    model_raw { "claude-haiku-4-5-20251001" }
    input_tokens { 100 }
    output_tokens { 50 }
    reasoning_tokens { 0 }
    cache_creation_tokens { 0 }
    cache_read_tokens { 0 }
    processed_at { nil }
    tags { [] }
    metadata { {} }
  end
end
