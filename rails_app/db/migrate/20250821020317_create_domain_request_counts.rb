class CreateDomainRequestCounts < ActiveRecord::Migration[8.0]
  def up
    safety_assured do 
      unless table_exists?(:domain_request_counts) 
        execute <<-SQL
          CREATE TABLE domain_request_counts (
              id BIGSERIAL NOT NULL,
              domain_id BIGINT NOT NULL,
              user_id BIGINT NOT NULL,
              request_count BIGINT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at);
      SQL
    end

      # Note: This index is created on the parent and automatically propagated to all partitions.
      execute <<-SQL
        CREATE INDEX IF NOT EXISTS index_domain_request_counts_on_domain_id_and_created_at
        ON domain_request_counts (domain_id, created_at);

        CREATE INDEX IF NOT EXISTS index_domain_request_counts_on_domain_created_count
        ON domain_request_counts (domain_id, created_at, request_count);

        CREATE INDEX IF NOT EXISTS index_domain_request_counts_on_user_id_and_created_at
        ON domain_request_counts (user_id, created_at);

        CREATE INDEX IF NOT EXISTS index_domain_request_counts_on_user_domain_and_created_at
        ON domain_request_counts (user_id, domain_id, created_at);
      SQL
    end
  end

  def down
    safety_assured do
      execute `DROP TABLE IF EXISTS domain_request_counts;`
    end
  end
end