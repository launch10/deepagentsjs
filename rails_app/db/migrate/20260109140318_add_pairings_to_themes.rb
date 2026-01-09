class AddPairingsToThemes < ActiveRecord::Migration[8.0]
  def change
    add_column :themes, :pairings, :jsonb
  end
end
