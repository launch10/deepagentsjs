class CreateProjectDeploys < ActiveRecord::Migration[8.0]
  def change
    create_table :deploys do |t|
      t.bigint :project_id, null: false, foreign_key: true
      t.string :status, null: false, default: "pending"
      t.string :current_step
      t.boolean :is_live, default: false
      t.text :stacktrace
      t.string :langgraph_thread_id
      t.bigint :website_deploy_id, foreign_key: { to_table: :website_deploys }
      t.bigint :campaign_deploy_id, foreign_key: true

      t.timestamps
      t.index [:project_id, :is_live]
      t.index [:project_id, :status]
      t.index :status
      t.index :is_live
      t.index :langgraph_thread_id
    end

  end
end
