class PartitionMaintenanceWorker
  include Sidekiq::Worker
  
  sidekiq_options queue: 'low', retry: 3

  def perform
    Rails.logger.info "[PartitionMaintenanceWorker] Starting partition maintenance"
    
    # Run the rake task to ensure partitions exist
    Rake::Task['partitions:ensure_partitions'].invoke
    
    Rails.logger.info "[PartitionMaintenanceWorker] Partition maintenance completed"
  rescue => e
    Rails.logger.error "[PartitionMaintenanceWorker] Error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    raise e
  ensure
    # Clear the rake task so it can be invoked again
    Rake::Task['partitions:ensure_partitions'].reenable if Rake::Task.task_defined?('partitions:ensure_partitions')
  end
end