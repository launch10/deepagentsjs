module Langgraph
  class CheckpointWrite < Langgraph::ReadonlyRecord
    self.table_name = "checkpoint_writes"
    self.primary_key = [:thread_id, :checkpoint_ns, :checkpoint_id, :task_id, :idx]

    include Langgraph::BlobDecodable

    scope :for_thread, ->(thread_id) { where(thread_id: thread_id) }
    scope :for_checkpoint, ->(checkpoint_id) { where(checkpoint_id: checkpoint_id) }
    scope :for_channel, ->(channel) { where(channel: channel.to_s) }
    scope :ordered, -> { order(:task_id, :idx) }
  end
end
