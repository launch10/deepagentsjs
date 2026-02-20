# == Schema Information
#
# Table name: checkpoint_writes
#
#  blob          :binary           not null
#  channel       :text             not null
#  checkpoint_ns :text             default(""), not null, primary key
#  idx           :integer          not null, primary key
#  type          :text
#  checkpoint_id :text             not null, primary key
#  task_id       :text             not null, primary key
#  thread_id     :text             not null, primary key
#
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
