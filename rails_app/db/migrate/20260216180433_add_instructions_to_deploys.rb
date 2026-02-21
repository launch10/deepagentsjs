class AddInstructionsToDeploys < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :deploys, :instructions, :jsonb, default: {}
    add_index :deploys, :instructions, using: :gin, algorithm: :concurrently
  end
end
