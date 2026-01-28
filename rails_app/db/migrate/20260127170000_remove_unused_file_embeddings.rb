class RemoveUnusedFileEmbeddings < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute <<-SQL
        -- Drop the code_files view (depends on embedding columns)
        DROP VIEW IF EXISTS code_files;

        -- Drop embedding indexes
        DROP INDEX IF EXISTS idx_website_files_embedding;
        DROP INDEX IF EXISTS idx_template_files_embedding;

        -- Drop embedding columns
        ALTER TABLE website_files DROP COLUMN IF EXISTS embedding;
        ALTER TABLE template_files DROP COLUMN IF EXISTS embedding;
        ALTER TABLE website_file_histories DROP COLUMN IF EXISTS embedding;

        -- Recreate code_files view without embedding
        CREATE OR REPLACE VIEW code_files AS
        WITH merged_files AS (
          SELECT
            wf.website_id,
            wf.path,
            wf.content,
            wf.content_tsv,
            wf.shasum,
            wf.created_at,
            wf.updated_at,
            'WebsiteFile' AS source_type,
            wf.id AS source_id
          FROM website_files wf

          UNION ALL

          SELECT
            w.id AS website_id,
            tf.path,
            tf.content,
            tf.content_tsv,
            tf.shasum,
            tf.created_at,
            tf.updated_at,
            'TemplateFile' AS source_type,
            tf.id AS source_id
          FROM template_files tf
          INNER JOIN websites w ON w.template_id = tf.template_id
          WHERE NOT EXISTS (
            SELECT 1
            FROM website_files wf2
            WHERE wf2.website_id = w.id
              AND wf2.path = tf.path
          )
        )
        SELECT
          website_id,
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

  def down
    safety_assured do
      execute <<-SQL
        -- Drop the view to modify underlying tables
        DROP VIEW IF EXISTS code_files;

        -- Re-add embedding columns
        ALTER TABLE website_files ADD COLUMN embedding vector(1536);
        ALTER TABLE template_files ADD COLUMN embedding vector(1536);
        ALTER TABLE website_file_histories ADD COLUMN embedding vector(1536);

        -- Re-add indexes
        CREATE INDEX idx_website_files_embedding ON website_files USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
        CREATE INDEX idx_template_files_embedding ON template_files USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

        -- Recreate code_files view with embedding
        CREATE OR REPLACE VIEW code_files AS
        WITH merged_files AS (
          SELECT
            wf.website_id,
            wf.path,
            wf.content,
            wf.content_tsv,
            wf.embedding,
            wf.shasum,
            wf.created_at,
            wf.updated_at,
            'WebsiteFile' AS source_type,
            wf.id AS source_id
          FROM website_files wf

          UNION ALL

          SELECT
            w.id AS website_id,
            tf.path,
            tf.content,
            tf.content_tsv,
            tf.embedding,
            tf.shasum,
            tf.created_at,
            tf.updated_at,
            'TemplateFile' AS source_type,
            tf.id AS source_id
          FROM template_files tf
          INNER JOIN websites w ON w.template_id = tf.template_id
          WHERE NOT EXISTS (
            SELECT 1
            FROM website_files wf2
            WHERE wf2.website_id = w.id
              AND wf2.path = tf.path
          )
        )
        SELECT
          website_id,
          path,
          content,
          content_tsv,
          embedding,
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
end
