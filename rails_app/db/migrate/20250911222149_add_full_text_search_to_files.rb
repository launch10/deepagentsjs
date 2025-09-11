class AddFullTextSearchToFiles < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute <<-SQL
        -- Add pg_trgm extension for trigram similarity search
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        
        -- Add tsvector columns to both tables
        ALTER TABLE website_files ADD COLUMN IF NOT EXISTS content_tsv tsvector;
        ALTER TABLE template_files ADD COLUMN IF NOT EXISTS content_tsv tsvector;
        
        -- Create GIN indexes with unique names
        CREATE INDEX IF NOT EXISTS idx_website_files_content_tsv ON website_files USING GIN(content_tsv);
        CREATE INDEX IF NOT EXISTS idx_template_files_content_tsv ON template_files USING GIN(content_tsv);
        
        -- Add trigram indexes for similarity search on paths
        CREATE INDEX IF NOT EXISTS idx_website_files_path_trgm ON website_files USING GIN(path gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_template_files_path_trgm ON template_files USING GIN(path gin_trgm_ops);
        
        -- Create function to update tsvector
        -- Using 'english' configuration for better code search (handles camelCase, snake_case)
        CREATE OR REPLACE FUNCTION update_content_tsv()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Use english configuration for better programming term handling
            -- Also include file path in search
            NEW.content_tsv := to_tsvector('english', 
              COALESCE(NEW.content, '') || ' ' || 
              COALESCE(regexp_replace(NEW.path, '[/.]', ' ', 'g'), '')
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        -- Create triggers with unique names
        DROP TRIGGER IF EXISTS tsvector_update_website_files ON website_files;
        CREATE TRIGGER tsvector_update_website_files
        BEFORE INSERT OR UPDATE OF content, path ON website_files
        FOR EACH ROW EXECUTE FUNCTION update_content_tsv();
        
        DROP TRIGGER IF EXISTS tsvector_update_template_files ON template_files;
        CREATE TRIGGER tsvector_update_template_files
        BEFORE INSERT OR UPDATE OF content, path ON template_files
        FOR EACH ROW EXECUTE FUNCTION update_content_tsv();
        
        -- Update existing rows to populate tsvector
        UPDATE website_files 
        SET content_tsv = to_tsvector('english', 
          COALESCE(content, '') || ' ' || 
          COALESCE(regexp_replace(path, '[/.]', ' ', 'g'), '')
        );
        
        UPDATE template_files 
        SET content_tsv = to_tsvector('english', 
          COALESCE(content, '') || ' ' || 
          COALESCE(regexp_replace(path, '[/.]', ' ', 'g'), '')
        );
      SQL
    end
  end
  
  def down
    safety_assured do
      execute <<-SQL
        -- Remove triggers
        DROP TRIGGER IF EXISTS tsvector_update_website_files ON website_files;
        DROP TRIGGER IF EXISTS tsvector_update_template_files ON template_files;
        
        -- Remove function
        DROP FUNCTION IF EXISTS update_content_tsv();
        
        -- Remove indexes
        DROP INDEX IF EXISTS idx_website_files_content_tsv;
        DROP INDEX IF EXISTS idx_template_files_content_tsv;
        DROP INDEX IF EXISTS idx_website_files_path_trgm;
        DROP INDEX IF EXISTS idx_template_files_path_trgm;
        
        -- Remove columns
        ALTER TABLE website_files DROP COLUMN IF EXISTS content_tsv;
        ALTER TABLE template_files DROP COLUMN IF EXISTS content_tsv;
      SQL
    end
  end
end