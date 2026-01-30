class CodeFilesViewService
  VIEW_NAME = "code_files".freeze

  # Regenerate the code_files view with current business logic
  def self.regenerate!
    new.regenerate!
  end

  def regenerate!
    ActiveRecord::Base.connection.execute(drop_sql)
    ActiveRecord::Base.connection.execute(create_sql)
  end

  def create_sql
    <<~SQL
      CREATE VIEW #{VIEW_NAME} AS
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
        WHERE wf.deleted_at IS NULL
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
        WHERE w.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM website_files wf2
            WHERE wf2.website_id = w.id
            AND wf2.path = tf.path
            AND wf2.deleted_at IS NULL
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

  def drop_sql
    "DROP VIEW IF EXISTS #{VIEW_NAME};"
  end
end
