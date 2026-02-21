class ReplaceInstructionsWithDeployType < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      add_column :deploys, :deploy_type, :string, default: "website", null: false

      # Backfill: if instructions had google_ads: true → "campaign", else → "website"
      execute <<~SQL
        UPDATE deploys
        SET deploy_type = CASE
          WHEN instructions->>'google_ads' = 'true' THEN 'campaign'
          ELSE 'website'
        END
      SQL

      add_index :deploys, :deploy_type

      remove_index :deploys, :instructions, name: "index_deploys_on_instructions"
      remove_column :deploys, :instructions
    end
  end

  def down
    safety_assured do
      add_column :deploys, :instructions, :jsonb, default: {}

      execute <<~SQL
        UPDATE deploys
        SET instructions = CASE
          WHEN deploy_type = 'campaign' THEN '{"website": true, "google_ads": true}'::jsonb
          ELSE '{"website": true, "google_ads": false}'::jsonb
        END
      SQL

      add_index :deploys, :instructions, using: :gin

      remove_index :deploys, :deploy_type
      remove_column :deploys, :deploy_type
    end
  end
end
