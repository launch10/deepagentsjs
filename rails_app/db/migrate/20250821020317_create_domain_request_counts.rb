class CreateDomainRequestCounts < ActiveRecord::Migration[8.0]
  def up
    safety_assured do 
      unless table_exists?(:domain_request_counts) 
        execute <<-SQL
          CREATE TABLE domain_request_counts (
              id BIGSERIAL NOT NULL,
              domain_id BIGINT NOT NULL,
              account_id BIGINT NOT NULL,
              request_count BIGINT NOT NULL,
              month TIMESTAMPTZ NOT NULL,
              hour TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (id, hour)
        ) PARTITION BY RANGE (month);
      SQL
    end

      # Note: This index is created on the parent and automatically propagated to all partitions.
      execute <<-SQL
        CREATE INDEX IF NOT EXISTS index_domain_request_counts_on_domain_id_and_hour
        ON domain_request_counts (domain_id, hour);

        CREATE INDEX IF NOT EXISTS index_domain_request_counts_on_domain_hour_count
        ON domain_request_counts (domain_id, hour, request_count);

        CREATE INDEX IF NOT EXISTS index_domain_request_counts_on_account_id_and_hour
        ON domain_request_counts (account_id, hour);

        CREATE UNIQUE INDEX IF NOT EXISTS index_domain_request_counts_on_account_domain_and_hour
        ON domain_request_counts (account_id, domain_id, hour);

        CREATE INDEX IF NOT EXISTS index_domain_request_counts_on_domain_id_and_month
        ON domain_request_counts (domain_id, month);

        CREATE INDEX IF NOT EXISTS index_domain_request_counts_on_domain_month_count
        ON domain_request_counts (domain_id, month, request_count);

        CREATE INDEX IF NOT EXISTS index_domain_request_counts_on_account_id_and_month
        ON domain_request_counts (account_id, month);

        CREATE UNIQUE INDEX IF NOT EXISTS index_domain_request_counts_on_account_domain_and_month
        ON domain_request_counts (account_id, domain_id, month);
      SQL
    end
  end

  def down
    safety_assured do
      execute "DROP TABLE IF EXISTS domain_request_counts;"
    end
  end
end