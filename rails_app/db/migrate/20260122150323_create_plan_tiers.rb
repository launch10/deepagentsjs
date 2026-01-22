class CreatePlanTiers < ActiveRecord::Migration[8.0]
  def change
    create_table :plan_tiers do |t|
      t.string :name, null: false
      t.string :description
      t.jsonb :details, default: {}

      t.timestamps
    end
    add_index :plan_tiers, :name, unique: true
  end
end
