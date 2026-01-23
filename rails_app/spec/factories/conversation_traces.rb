# == Schema Information
#
# Table name: conversation_traces
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
#  conversation_traces_chat_id_created_at_idx    (chat_id,created_at)
#  conversation_traces_run_id_created_at_idx     (run_id,created_at) UNIQUE
#  conversation_traces_thread_id_created_at_idx  (thread_id,created_at)
#
FactoryBot.define do
  factory :conversation_trace do
    association :chat
    thread_id { SecureRandom.uuid }
    run_id { SecureRandom.uuid }
    graph_name { "brainstorm" }
    messages { [{ "type" => "human", "content" => "Hello" }] }
    system_prompt { "You are a helpful assistant." }
    usage_summary { { "total_cost_microcents" => 1000, "llm_call_count" => 1 } }
    llm_calls { [{ "model" => "claude-haiku" }] }
  end
end
