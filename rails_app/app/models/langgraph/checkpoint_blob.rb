# == Schema Information
#
# Table name: checkpoint_blobs
#
#  blob          :binary
#  channel       :text             not null, primary key
#  checkpoint_ns :text             default(""), not null, primary key
#  type          :text             not null
#  version       :text             not null, primary key
#  thread_id     :text             not null, primary key
#
module Langgraph
  class CheckpointBlob < Langgraph::ReadonlyRecord
    self.table_name = "checkpoint_blobs"
    self.primary_key = [:thread_id, :checkpoint_ns, :channel, :version]

    include Langgraph::BlobDecodable

    scope :for_thread, ->(thread_id) { where(thread_id: thread_id) }
    scope :for_channel, ->(channel) { where(channel: channel.to_s) }
    scope :non_empty, -> { where.not(type: "empty") }
  end
end
