class AddThreadIdToDeploys < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :deploys, :thread_id, :string, default: -> { "gen_random_uuid()" }, null: false
      change_column_default :deploys, :thread_id, from: -> { "gen_random_uuid()" }, to: nil
      add_index :deploys, :thread_id
    end
  end
end
