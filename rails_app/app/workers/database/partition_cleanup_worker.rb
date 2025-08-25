module Database
  class PartitionCleanupWorker < ApplicationWorker
    def perform
      DomainRequestCount.drop_old_partitions(retention_days: 30)
      AccountRequestCount.drop_old_partitions(retention_months: 12)
    end
  end
end