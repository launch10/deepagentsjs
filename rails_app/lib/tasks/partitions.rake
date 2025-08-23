namespace :partitions do
  desc "Create partitions for the next month"
  task create_monthly: :environment do
    Rails.logger.info "[Partitions] Starting monthly partition creation..."
    
    begin
      # Create domain_request_counts partitions (daily partitions for next month)
      create_domain_request_count_partitions
      
      # Create user_request_counts partitions (monthly partition for 3 months ahead)
      create_user_request_count_partitions
      
      # Clean up old partitions (optional, keeps last 3 months)
      cleanup_old_partitions if ENV['CLEANUP_OLD_PARTITIONS'] == 'true'
      
      Rails.logger.info "[Partitions] Successfully created monthly partitions"
    rescue => e
      Rails.logger.error "[Partitions] Error creating partitions: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      raise e
    end
  end

  desc "Check and create partitions if needed"
  task ensure_partitions: :environment do
    Rails.logger.info "[Partitions] Checking partition status..."
    
    # Check if we have partitions for the next 30 days
    next_month = Date.current + 1.month
    partition_name = "domain_request_counts_#{next_month.strftime('%Y_%m_%d')}"
    
    result = ActiveRecord::Base.connection.execute(<<-SQL)
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = '#{partition_name}'
    SQL
    
    if result.count == 0
      Rails.logger.info "[Partitions] Missing partitions detected, creating..."
      Rake::Task['partitions:create_monthly'].invoke
    else
      Rails.logger.info "[Partitions] Partitions are up to date"
    end
  end

  private

  def create_domain_request_count_partitions
    Rails.logger.info "[Partitions] Creating domain_request_count partitions..."
    
    # Get the next month that doesn't have partitions yet
    next_month = Date.current.beginning_of_month + 1.month
    
    # Check if partition already exists for the first day of next month
    first_partition_name = "domain_request_counts_#{next_month.strftime('%Y_%m_01')}"
    
    result = ActiveRecord::Base.connection.execute(<<-SQL)
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = '#{first_partition_name}'
    SQL
    
    if result.count == 0
      days_in_month = next_month.end_of_month.day
      
      days_in_month.times do |day|
        partition_date = next_month + day.days
        partition_name = "domain_request_counts_#{partition_date.strftime('%Y_%m_%d')}"
        start_time = partition_date.beginning_of_day
        end_time = (partition_date + 1.day).beginning_of_day
        
        ActiveRecord::Base.connection.execute(<<-SQL)
          CREATE TABLE IF NOT EXISTS #{partition_name} 
          PARTITION OF domain_request_counts 
          FOR VALUES FROM ('#{start_time.to_fs(:db)}') TO ('#{end_time.to_fs(:db)}');
        SQL
        
        Rails.logger.info "[Partitions] Created partition: #{partition_name}"
      end
    else
      Rails.logger.info "[Partitions] Domain request count partitions already exist for #{next_month.strftime('%Y-%m')}"
    end
  end

  def create_user_request_count_partitions
    Rails.logger.info "[Partitions] Creating user_request_count partitions..."
    
    # Create partitions for 3 months ahead
    current_date = Date.current
    
    3.times do |offset|
      # Start from 2 months ahead (assuming current and next month already exist)
      month_offset = offset + 2
      date = current_date.beginning_of_month + month_offset.months
      partition_name = "user_request_counts_#{date.strftime('%Y_%m')}"
      
      # Check if partition already exists
      result = ActiveRecord::Base.connection.execute(<<-SQL)
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = '#{partition_name}'
      SQL
      
      if result.count == 0
        start_time = date.beginning_of_month
        end_time = (date + 1.month).beginning_of_month
        
        ActiveRecord::Base.connection.execute(<<-SQL)
          CREATE TABLE IF NOT EXISTS #{partition_name} 
          PARTITION OF user_request_counts 
          FOR VALUES FROM ('#{start_time.to_fs(:db)}') TO ('#{end_time.to_fs(:db)}');
        SQL
        
        Rails.logger.info "[Partitions] Created partition: #{partition_name}"
      else
        Rails.logger.info "[Partitions] User request count partition already exists: #{partition_name}"
      end
    end
  end

  def cleanup_old_partitions
    Rails.logger.info "[Partitions] Cleaning up old partitions..."
    
    # Keep only last 3 months of domain_request_counts partitions
    cutoff_date = Date.current - 3.months
    
    # Get list of old domain partitions
    result = ActiveRecord::Base.connection.execute(<<-SQL)
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'domain_request_counts_%'
      AND tablename < 'domain_request_counts_#{cutoff_date.strftime('%Y_%m')}'
    SQL
    
    result.each do |row|
      partition_name = row['tablename']
      ActiveRecord::Base.connection.execute("DROP TABLE IF EXISTS #{partition_name}")
      Rails.logger.info "[Partitions] Dropped old partition: #{partition_name}"
    end
    
    # Keep only last 6 months of user_request_counts partitions
    user_cutoff_date = Date.current - 6.months
    
    result = ActiveRecord::Base.connection.execute(<<-SQL)
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'user_request_counts_%'
      AND tablename < 'user_request_counts_#{user_cutoff_date.strftime('%Y_%m')}'
    SQL
    
    result.each do |row|
      partition_name = row['tablename']
      ActiveRecord::Base.connection.execute("DROP TABLE IF EXISTS #{partition_name}")
      Rails.logger.info "[Partitions] Dropped old partition: #{partition_name}"
    end
  end
end