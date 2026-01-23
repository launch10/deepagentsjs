class CreateConversationTraces < ActiveRecord::Migration[8.0]
  def change
    # Partitioned table - cannot use disable_ddl_transaction! with partitions
    safety_assured do
      execute <<-SQL
      CREATE TABLE conversation_traces (
        id bigserial,
        chat_id bigint NOT NULL,
        thread_id varchar NOT NULL,
        run_id varchar NOT NULL,
        graph_name varchar,
        messages jsonb NOT NULL,
        system_prompt text,
        usage_summary jsonb,
        llm_calls jsonb,
        created_at timestamp NOT NULL,
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at);

      CREATE UNIQUE INDEX conversation_traces_run_id_created_at_idx
        ON conversation_traces (run_id, created_at);
      CREATE INDEX conversation_traces_thread_id_created_at_idx
        ON conversation_traces (thread_id, created_at);
      CREATE INDEX conversation_traces_chat_id_created_at_idx
        ON conversation_traces (chat_id, created_at);

      -- Initial partitions for 2026
      CREATE TABLE conversation_traces_2026_01
        PARTITION OF conversation_traces
        FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

      CREATE TABLE conversation_traces_2026_02
        PARTITION OF conversation_traces
        FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

      CREATE TABLE conversation_traces_2026_03
        PARTITION OF conversation_traces
        FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
      SQL
    end
  end

  def down
    safety_assured do
      execute <<-SQL
        DROP TABLE IF EXISTS conversation_traces CASCADE;
      SQL
    end
  end
end
