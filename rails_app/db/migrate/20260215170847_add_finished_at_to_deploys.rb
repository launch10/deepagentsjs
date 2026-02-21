class AddFinishedAtToDeploys < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :deploys, :finished_at, :datetime
    add_index :deploys, :finished_at, algorithm: :concurrently
  end
end
