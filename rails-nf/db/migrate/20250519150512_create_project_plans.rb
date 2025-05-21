class CreateProjectPlans < ActiveRecord::Migration[8.0]
  def change
    create_table :project_plans do |t|
      t.bigint :project_id, null: false
      t.string :tone, null: false
      t.string :core_emotional_driver
      t.string :attention_grabber
      t.string :problem_statement
      t.string :emotional_bridge
      t.string :product_reveal
      t.string :social_proof
      t.string :urgency_hook
      t.string :call_to_action
      t.string :page_mood
      t.string :visual_evocation
      t.text :landing_page_copy

      t.timestamps

      t.index :project_id
      t.index :created_at
      t.index :updated_at
    end
  end
end
