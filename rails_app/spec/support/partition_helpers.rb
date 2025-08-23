module PartitionHelpers
  # Create only the specific partitions needed for test data
  def create_minimal_partitions_for_dates(*dates)
    dates.flatten.each do |date|
      hour = date.beginning_of_hour
      partition_name = "domain_request_counts_#{hour.strftime('%Y_%m_%d_%H')}"
      
      ActiveRecord::Base.connection.execute <<-SQL
        CREATE TABLE IF NOT EXISTS #{partition_name} 
        PARTITION OF domain_request_counts 
        FOR VALUES FROM ('#{hour.to_fs(:db)}') TO ('#{(hour + 1.hour).to_fs(:db)}')
      SQL
    end
  end

  # Create partitions for a range with caching to avoid recreating
  def ensure_partitions_exist_for_range(start_date, end_date)
    @partition_cache ||= Set.new
    
    current = start_date.beginning_of_hour
    while current <= end_date
      cache_key = current.strftime('%Y_%m_%d_%H')
      
      unless @partition_cache.include?(cache_key)
        partition_name = "domain_request_counts_#{cache_key}"
        
        begin
          ActiveRecord::Base.connection.execute <<-SQL
            CREATE TABLE IF NOT EXISTS #{partition_name} 
            PARTITION OF domain_request_counts 
            FOR VALUES FROM ('#{current.to_fs(:db)}') TO ('#{(current + 1.hour).to_fs(:db)}')
          SQL
          @partition_cache.add(cache_key)
        rescue ActiveRecord::StatementInvalid => e
          # Partition already exists, add to cache
          @partition_cache.add(cache_key) if e.message.include?("already exists")
        end
      end
      
      current += 1.hour
    end
  end

  # Fast cleanup - drop all partitions in a single query
  def drop_all_partitions_fast
    ActiveRecord::Base.connection.execute(<<-SQL)
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN 
          SELECT tablename 
          FROM pg_tables 
          WHERE tablename LIKE 'domain_request_counts_%' 
             OR tablename LIKE 'user_request_counts_%'
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || r.tablename || ' CASCADE';
        END LOOP;
      END $$;
    SQL
  end
end

RSpec.configure do |config|
  config.include PartitionHelpers
end