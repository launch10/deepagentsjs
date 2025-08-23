module Partitionable
  extend ActiveSupport::Concern

  class_methods do
    def create_partitions(num_periods)
      if partition_by_hour?
        create_hourly_partitions(num_periods)
      else
        create_monthly_partitions(num_periods)
      end
    end

    def drop_all_partitions
      partitions = ActiveRecord::Base.connection.execute(<<-SQL).to_a
        SELECT tablename FROM pg_tables 
        WHERE tablename LIKE '#{table_name}_%';
      SQL
      
      partitions.each do |partition|
        ActiveRecord::Base.connection.execute("DROP TABLE IF EXISTS #{partition['tablename']};")
      end
    end

    private

    def partition_by_hour?
      # Override this in including classes if needed
      table_name == 'domain_request_counts'
    end

    def create_hourly_partitions(num_days)
      sql_statements = []
      
      num_days.times do |i|
        date = Date.current + i.days
        
        (0..23).each do |hour|
          start_time = date.beginning_of_day + hour.hours
          end_time = start_time + 1.hour
          partition_name = "#{table_name}_#{start_time.strftime('%Y_%m_%d_%H')}"
          
          sql_statements << <<-SQL
            CREATE TABLE IF NOT EXISTS #{partition_name} 
            PARTITION OF #{table_name} 
            FOR VALUES FROM ('#{start_time.to_fs(:db)}') TO ('#{end_time.to_fs(:db)}')
          SQL
        end
      end
      
      # Execute all in one transaction for better performance
      ActiveRecord::Base.transaction do
        sql_statements.each { |sql| connection.execute(sql) }
      end
    end

    def create_monthly_partitions(num_months)
      sql_statements = []
      
      num_months.times do |i|
        start_time = (Date.current + i.months).beginning_of_month
        end_time = start_time + 1.month
        partition_name = "#{table_name}_#{start_time.strftime('%Y_%m')}"
        
        sql_statements << <<-SQL
          CREATE TABLE IF NOT EXISTS #{partition_name} 
          PARTITION OF #{table_name} 
          FOR VALUES FROM ('#{start_time.to_fs(:db)}') TO ('#{end_time.to_fs(:db)}')
        SQL
      end
      
      # Execute all at once in a single transaction
      ActiveRecord::Base.transaction do
        sql_statements.each { |sql| connection.execute(sql) }
      end
    end
  end
end