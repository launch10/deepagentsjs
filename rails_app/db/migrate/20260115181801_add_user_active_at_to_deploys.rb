class AddUserActiveAtToDeploys < ActiveRecord::Migration[8.0]
  def change
    add_column :deploys, :user_active_at, :datetime
  end
end
