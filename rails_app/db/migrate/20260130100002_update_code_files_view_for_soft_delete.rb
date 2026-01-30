class UpdateCodeFilesViewForSoftDelete < ActiveRecord::Migration[8.0]
  def up
    CodeFilesViewService.regenerate!
  end

  def down
    # Restore previous view definition (without deleted_at filter)
    execute <<~SQL
      DROP VIEW IF EXISTS code_files;
      CREATE VIEW code_files AS
      WITH merged_files AS (
        SELECT wf.website_id,
          wf.path,
          wf.content,
          wf.content_tsv,
          wf.shasum,
          wf.created_at,
          wf.updated_at,
          'WebsiteFile'::text AS source_type,
          wf.id AS source_id
        FROM website_files wf
        UNION ALL
        SELECT w.id AS website_id,
          tf.path,
          tf.content,
          tf.content_tsv,
          tf.shasum,
          tf.created_at,
          tf.updated_at,
          'TemplateFile'::text AS source_type,
          tf.id AS source_id
        FROM template_files tf
        JOIN websites w ON w.template_id = tf.template_id
        WHERE NOT EXISTS (
          SELECT 1 FROM website_files wf2
          WHERE wf2.website_id = w.id
          AND wf2.path = tf.path
        )
      )
      SELECT website_id,
        path,
        content,
        content_tsv,
        shasum,
        source_type,
        source_id,
        created_at,
        updated_at
      FROM merged_files
      ORDER BY website_id, path;
    SQL
  end
end
