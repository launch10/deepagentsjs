module Langgraph
  module ThreadAccessible
    extend ActiveSupport::Concern

    def langgraph_state(**options)
      Langgraph::Checkpoint.state_for(thread_id, **options)
    end

    def langgraph_channel(channel_name)
      Langgraph::Checkpoint.latest_for_thread(thread_id).first&.channel_value(channel_name)
    end

    def latest_checkpoint
      Langgraph::Checkpoint.latest_for_thread(thread_id).first
    end
  end
end
