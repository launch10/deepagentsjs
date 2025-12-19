class CreateCodeFileHistoriesView < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute <<-SQL
        CREATE OR REPLACE VIEW code_file_histories AS
        WITH merged_files AS (
          -- Get all website file histories
          SELECT 
            wfh.website_id,
            wfh.snapshot_id,
            wfh.path,
            wfh.content,
            wfh.content_tsv,
            wfh.shasum,
            wfh.file_specification_id,
            wfh.created_at,
            wfh.updated_at,
            'WebsiteFile' AS source_type,
            wfh.website_file_id AS source_id
          FROM website_file_histories wfh
          
          UNION ALL
          
          -- Get current template files that don't have a matching website file history
          -- for the same website and snapshot
          SELECT 
            wh.website_id,
            wh.snapshot_id,
            tf.path,
            tf.content,
            tf.content_tsv,
            tf.shasum,
            tf.file_specification_id,
            tf.created_at,
            tf.updated_at,
            'TemplateFile' AS source_type,
            tf.id AS source_id
          FROM template_files tf
          INNER JOIN websites w ON w.template_id = tf.template_id
          INNER JOIN website_histories wh ON wh.website_id = w.id
            AND wh.snapshot_id IS NOT NULL
          WHERE NOT EXISTS (
            SELECT 1 
            FROM website_file_histories wfh2 
            WHERE wfh2.website_id = wh.website_id
              AND wfh2.snapshot_id = wh.snapshot_id
              AND wfh2.path = tf.path
          )
        )
        SELECT 
          website_id,
          snapshot_id,
          path,
          content,
          content_tsv,
          shasum,
          file_specification_id,
          source_type,
          source_id,
          created_at,
          updated_at
        FROM merged_files
        ORDER BY website_id, snapshot_id, path;
      SQL
    end
  end

  def down
    execute "DROP VIEW IF EXISTS code_file_histories;"
  end
end
