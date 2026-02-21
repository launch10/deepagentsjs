class AddActiveIndexToDeploys < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :deploys, [:project_id, :active], unique: true,
      where: "deleted_at IS NULL AND active = true",
      name: :index_deploys_on_active_project,
      algorithm: :concurrently
  end
end
