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
    
    def drop_old_partitions(retention_days: nil, retention_months: nil)
      cutoff_date = if retention_days
        Date.current - retention_days.days
      elsif retention_months
        Date.current - retention_months.months
      else
        raise ArgumentError, "Must specify either retention_days or retention_months"
      end
      
      pattern = if partition_by_hour?
        # Match hourly partitions older than cutoff
        "#{table_name}_%"
      else
        # Match monthly partitions older than cutoff
        "#{table_name}_%"
      end
      
      partitions = ActiveRecord::Base.connection.execute(<<-SQL).to_a
        SELECT tablename FROM pg_tables 
        WHERE tablename LIKE '#{pattern}'
        AND schemaname = 'public';
      SQL
      
      dropped_count = 0
      partitions.each do |partition|
        partition_name = partition['tablename']
        
        # Extract date from partition name
        if partition_by_hour? && partition_name =~ /(\d{4})_(\d{2})_(\d{2})_(\d{2})$/
          partition_date = Date.new($1.to_i, $2.to_i, $3.to_i)
        elsif !partition_by_hour? && partition_name =~ /(\d{4})_(\d{2})$/
          partition_date = Date.new($1.to_i, $2.to_i, 1)
        else
          next # Skip if pattern doesn't match
        end
        
        if partition_date < cutoff_date
          ActiveRecord::Base.connection.execute("DROP TABLE IF EXISTS #{partition_name};")
          dropped_count += 1
          Rails.logger.info "Dropped old partition: #{partition_name}"
        end
      end
      
      Rails.logger.info "Dropped #{dropped_count} old partitions for #{table_name}"
      dropped_count
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