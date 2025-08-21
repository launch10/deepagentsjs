class CreatePlanLimits < ActiveRecord::Migration[8.0]
  def change
    create_table :plan_limits do |t|
      t.bigint :plan_id
      t.string :limit_type
      t.integer :limit

      t.timestamps
      t.index :created_at
      t.index :plan_id
      t.index :limit_type
      t.index :limit
      t.index [:plan_id, :limit_type], unique: true
    end
  end
end
