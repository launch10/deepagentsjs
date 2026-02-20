module Langgraph
  class Checkpoint < Langgraph::ReadonlyRecord
    self.table_name = "checkpoints"
    self.primary_key = [:thread_id, :checkpoint_ns, :checkpoint_id]

    scope :for_thread, ->(thread_id) { where(thread_id: thread_id) }
    scope :latest_for_thread, ->(thread_id, checkpoint_ns: "") {
      where(thread_id: thread_id, checkpoint_ns: checkpoint_ns)
        .order(checkpoint_id: :desc).limit(1)
    }
    scope :chronological, -> { order(checkpoint_id: :asc) }
    scope :reverse_chronological, -> { order(checkpoint_id: :desc) }

    def channel_versions
      checkpoint&.dig("channel_versions") || {}
    end

    # Reconstruct full state from checkpoint + blobs.
    # Options: only: [:status], except: [:messages, :jwt]
    def thread_state(only: nil, except: nil)
      versions = channel_versions
      versions = versions.slice(*only.map(&:to_s)) if only
      versions = versions.except(*except.map(&:to_s)) if except

      blobs = load_blobs(versions)
      Langgraph::ThreadState.new(checkpoint: self, channel_values: blobs)
    end

    # Load a single channel value (avoids loading everything)
    def channel_value(channel_name)
      version = channel_versions[channel_name.to_s]
      return nil unless version

      Langgraph::CheckpointBlob.find_by(
        thread_id: thread_id, checkpoint_ns: checkpoint_ns,
        channel: channel_name.to_s, version: version
      )&.decoded_blob
    end

    # Primary entry point: Langgraph::Checkpoint.state_for(thread_id)
    def self.state_for(thread_id, checkpoint_ns: "", **)
      latest_for_thread(thread_id, checkpoint_ns: checkpoint_ns)
        .first&.thread_state(**)
    end

    private

    def load_blobs(versions)
      return {} if versions.empty?

      conditions = versions.map do |channel, version|
        tbl = Langgraph::CheckpointBlob.arel_table
        tbl[:channel].eq(channel).and(tbl[:version].eq(version))
      end

      Langgraph::CheckpointBlob
        .where(thread_id: thread_id, checkpoint_ns: checkpoint_ns)
        .where(conditions.reduce(:or))
        .index_by(&:channel)
        .transform_values(&:decoded_blob)
    end
  end
end
