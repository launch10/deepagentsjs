class CreateUserRequestCounts < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      unless table_exists?(:user_request_counts)
        execute <<-SQL
          CREATE TABLE user_request_counts (
              id BIGSERIAL NOT NULL,
              user_id BIGINT NOT NULL,
              request_count BIGINT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL,
              PRIMARY KEY (id, created_at)
          ) PARTITION BY RANGE (created_at);
        SQL
      end

      unless index_exists?(:user_request_counts, :index_user_request_counts_on_user_id_and_created_at) 
        execute <<-SQL
          CREATE INDEX IF NOT EXISTS index_user_request_counts_on_user_id_and_created_at
          ON user_request_counts (user_id, created_at);
        SQL
      end

      unless index_exists?(:user_request_counts, :index_user_request_counts_on_user_created_count) 
        execute <<-SQL
          CREATE INDEX IF NOT EXISTS index_user_request_counts_on_user_created_count
          ON user_request_counts (user_id, created_at, request_count);
        SQL
      end
    end
  end

  def down
    safety_assured do
      execute `DROP TABLE IF EXISTS user_request_counts;`
    end
  end
end
