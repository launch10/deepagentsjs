class Add2026Partitions < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      # Create partitions for the next 12 months
      DomainRequestCount.create_partitions(12)
      AccountRequestCount.create_partitions(12)
    end
  end

  def down
    # Partitions will be dropped automatically when the parent table is dropped
  end
end
