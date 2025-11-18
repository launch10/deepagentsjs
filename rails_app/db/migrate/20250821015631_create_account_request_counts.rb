class CreateAccountRequestCounts < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      unless table_exists?(:account_request_counts)
        execute <<-SQL
          CREATE TABLE account_request_counts (
              id BIGSERIAL NOT NULL,
              account_id BIGINT NOT NULL,
              request_count BIGINT NOT NULL,
              month TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ NOT NULL,
              PRIMARY KEY (id, month)
          ) PARTITION BY RANGE (month);
        SQL
      end

      unless index_exists?(:account_request_counts, :index_account_request_counts_on_account_id_and_month)
        execute <<-SQL
          CREATE INDEX IF NOT EXISTS index_account_request_counts_on_account_id_and_month
          ON account_request_counts (account_id, month);
        SQL
      end

      unless index_exists?(:account_request_counts, :index_account_request_counts_on_account_month)
        execute <<-SQL
          CREATE UNIQUE INDEX IF NOT EXISTS index_account_request_counts_on_account_month
          ON account_request_counts (account_id, month, request_count);
        SQL
      end
    end
  end

  def down
    safety_assured do
      execute "DROP TABLE IF EXISTS account_request_counts;"
    end
  end
end
