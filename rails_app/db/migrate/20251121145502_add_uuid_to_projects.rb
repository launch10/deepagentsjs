class AddUUIDToProjects < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    safety_assured do
      add_column :projects, :uuid, :uuid, default: "gen_random_uuid()", null: false
      add_index :projects, :uuid, unique: true, algorithm: :concurrently
    end
  end
end