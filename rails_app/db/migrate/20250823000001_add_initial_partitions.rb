class AddInitialPartitions < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      # Create partitions for domain_request_counts (monthly partitions)
      # Create partitions for current month and next 3 months
      create_domain_request_count_partitions
      
      # Create partitions for user_request_counts (monthly partitions)
      # Create partitions for current month and next 3 months
      create_user_request_count_partitions
    end
  end

  def down
    # Partitions will be dropped automatically when the parent table is dropped
  end

  private

  def create_domain_request_count_partitions
    # Create monthly partitions for next 4 months (same as account_request_counts)
    DomainRequestCount.create_partitions(4)
  end

  def create_user_request_count_partitions
    AccountRequestCount.create_partitions(4)
  end
end