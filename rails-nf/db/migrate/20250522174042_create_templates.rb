class CreateTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :templates do |t|
      t.string :name
      t.timestamps

      t.index :name, unique: true
    end
  end
end
