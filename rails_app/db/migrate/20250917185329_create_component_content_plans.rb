class CreateComponentContentPlans < ActiveRecord::Migration[8.0]
  def change
    create_table :component_content_plans do |t|
      t.bigint :component_overview_id, null: false
      t.string :section_type # hero, benefits, etc
      t.jsonb :data, null: false, default: {}

      t.timestamps

      t.index :section_type
      t.index :created_at
      t.index :data, using: :gin
      t.index :component_overview_id
    end
  end
end
