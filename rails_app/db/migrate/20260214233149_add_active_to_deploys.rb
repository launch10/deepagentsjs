class AddActiveToDeploys < ActiveRecord::Migration[8.0]
  def change
    add_column :deploys, :active, :boolean, default: true, null: false
  end
end
