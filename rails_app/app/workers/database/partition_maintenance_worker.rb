module Database
  class PartitionMaintenanceWorker
    include Sidekiq::Worker
    
    sidekiq_options queue: 'low', retry: 3

    def perform
      AccountRequestCount.create_partitions(2) # Monthly
      DomainRequestCount.create_partitions(2) # Monthly
    end
  end
end