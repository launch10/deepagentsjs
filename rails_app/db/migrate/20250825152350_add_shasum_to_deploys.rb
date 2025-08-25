class AddShasumToDeploys < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :deploys, :shasum, :string
    add_index :deploys, :shasum, algorithm: :concurrently
  end
end
