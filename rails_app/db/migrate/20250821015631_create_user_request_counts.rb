class CreateUserRequestCounts < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute <<-SQL
        CREATE TABLE user_request_counts (
            id BIGSERIAL NOT NULL,
            user_id BIGINT NOT NULL,
            request_count BIGINT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at);
      SQL

      # Note: This index is created on the parent and automatically propagated to all partitions.
      execute <<-SQL
        CREATE INDEX index_user_request_counts_on_user_id_and_created_at
        ON user_request_counts (user_id, created_at);

        CREATE INDEX index_user_request_counts_on_user_created_count
        ON user_request_counts (user_id, created_at, request_count);
      SQL
    end
  end

  def down
    safety_assured do
      execute `DROP TABLE IF EXISTS user_request_counts;`
    end
  end
end
