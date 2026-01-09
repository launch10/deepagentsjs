class CreateLeads < ActiveRecord::Migration[8.0]
  def change
    create_table :leads do |t|
      t.bigint :project_id, null: false
      t.string :email, null: false, limit: 255
      t.string :name, limit: 255

      t.timestamps

      t.index :project_id
      t.index :email
      t.index [:project_id, :email], unique: true
    end
  end
end
