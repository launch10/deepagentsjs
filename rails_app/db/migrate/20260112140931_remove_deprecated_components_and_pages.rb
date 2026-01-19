# frozen_string_literal: true

class RemoveDeprecatedComponentsAndPages < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      # Drop views first since they depend on file_specification_id
      execute "DROP VIEW IF EXISTS public.code_files CASCADE"
      execute "DROP VIEW IF EXISTS public.code_file_histories CASCADE"

      # Drop the deprecated tables
      drop_table :component_content_plans, if_exists: true
      drop_table :component_overviews, if_exists: true
      drop_table :components, if_exists: true
      drop_table :content_strategies, if_exists: true
      drop_table :pages, if_exists: true
      drop_table :file_specifications, if_exists: true

      # Remove file_specification_id from remaining tables
      remove_column :website_files, :file_specification_id if column_exists?(:website_files, :file_specification_id)
      remove_column :template_files, :file_specification_id if column_exists?(:template_files, :file_specification_id)
      remove_column :website_file_histories, :file_specification_id if column_exists?(:website_file_histories, :file_specification_id)
      remove_column :tasks, :file_specification_id if column_exists?(:tasks, :file_specification_id)

      # Recreate code_files view without file_specification_id
      execute <<~SQL
        CREATE VIEW public.code_files AS
        WITH merged_files AS (
          SELECT wf.website_id,
            wf.path,
            wf.content,
            wf.content_tsv,
            wf.embedding,
            wf.shasum,
            wf.created_at,
            wf.updated_at,
            'WebsiteFile'::text AS source_type,
            wf.id AS source_id
          FROM public.website_files wf
          UNION ALL
          SELECT w.id AS website_id,
            tf.path,
            tf.content,
            tf.content_tsv,
            tf.embedding,
            tf.shasum,
            tf.created_at,
            tf.updated_at,
            'TemplateFile'::text AS source_type,
            tf.id AS source_id
          FROM (public.template_files tf
            JOIN public.websites w ON ((w.template_id = tf.template_id)))
          WHERE (NOT (EXISTS (SELECT 1
            FROM public.website_files wf2
            WHERE ((wf2.website_id = w.id) AND ((wf2.path)::text = (tf.path)::text)))))
        )
        SELECT website_id,
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

      # Recreate code_file_histories view without file_specification_id
      execute <<~SQL
        CREATE VIEW public.code_file_histories AS
        WITH merged_files AS (
          SELECT wfh.website_id,
            wfh.snapshot_id,
            wfh.path,
            wfh.content,
            wfh.content_tsv,
            wfh.shasum,
            wfh.created_at,
            wfh.updated_at,
            'WebsiteFile'::text AS source_type,
            wfh.website_file_id AS source_id
          FROM public.website_file_histories wfh
          UNION ALL
          SELECT wh.website_id,
            wh.snapshot_id,
            tf.path,
            tf.content,
            tf.content_tsv,
            tf.shasum,
            tf.created_at,
            tf.updated_at,
            'TemplateFile'::text AS source_type,
            tf.id AS source_id
          FROM ((public.template_files tf
            JOIN public.websites w ON ((w.template_id = tf.template_id)))
            JOIN public.website_histories wh ON (((wh.website_id = w.id) AND (wh.snapshot_id IS NOT NULL))))
          WHERE (NOT (EXISTS (SELECT 1
            FROM public.website_file_histories wfh2
            WHERE ((wfh2.website_id = wh.website_id) AND ((wfh2.snapshot_id)::text = (wh.snapshot_id)::text) AND ((wfh2.path)::text = (tf.path)::text)))))
        )
        SELECT website_id,
          snapshot_id,
          path,
          content,
          content_tsv,
          shasum,
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
    safety_assured do
      # Drop the views
      execute "DROP VIEW IF EXISTS public.code_files CASCADE"
      execute "DROP VIEW IF EXISTS public.code_file_histories CASCADE"

      # Re-add file_specification_id columns
      add_column :website_files, :file_specification_id, :bigint unless column_exists?(:website_files, :file_specification_id)
      add_column :template_files, :file_specification_id, :integer unless column_exists?(:template_files, :file_specification_id)
      add_column :website_file_histories, :file_specification_id, :integer unless column_exists?(:website_file_histories, :file_specification_id)
      add_column :tasks, :file_specification_id, :bigint unless column_exists?(:tasks, :file_specification_id)

      add_index :website_files, :file_specification_id, name: "index_website_files_on_file_specification_id" unless index_exists?(:website_files, :file_specification_id)
      add_index :template_files, :file_specification_id, name: "index_template_files_on_file_specification_id" unless index_exists?(:template_files, :file_specification_id)
      add_index :website_file_histories, :file_specification_id, name: "index_website_file_histories_on_file_specification_id" unless index_exists?(:website_file_histories, :file_specification_id)
      add_index :tasks, :file_specification_id, name: "index_tasks_on_file_specification_id" unless index_exists?(:tasks, :file_specification_id)

      # Recreate file_specifications table
      create_table :file_specifications do |t|
        t.string :canonical_path
        t.string :description
        t.string :filetype
        t.string :component_type
        t.string :language
        t.timestamps
      end
      add_index :file_specifications, :canonical_path
      add_index :file_specifications, :component_type
      add_index :file_specifications, :filetype

      # Recreate pages table
      create_table :pages do |t|
        t.string :name
        t.string :page_type, null: false
        t.bigint :website_id
        t.bigint :website_file_id
        t.string :path
        t.bigint :file_specification_id
        t.timestamps
      end
      add_index :pages, :created_at
      add_index :pages, :file_specification_id
      add_index :pages, :path
      add_index :pages, :website_id

      # Recreate content_strategies table
      create_table :content_strategies do |t|
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
        t.integer :website_id
        t.text :summary
        t.string :audience
        t.timestamps
      end
      add_index :content_strategies, :created_at
      add_index :content_strategies, :website_id

      # Recreate components table
      create_table :components do |t|
        t.bigint :website_id, null: false
        t.bigint :page_id, null: false
        t.string :name, null: false
        t.string :path
        t.string :component_type
        t.bigint :file_specification_id, null: false
        t.integer :theme_variant_id
        t.integer :component_overview_id
        t.integer :component_content_plan_id
        t.integer :website_file_id
        t.timestamps
      end
      add_index :components, :component_type
      add_index :components, :created_at
      add_index :components, :file_specification_id
      add_index :components, :name
      add_index :components, :page_id
      add_index :components, :path
      add_index :components, :website_id

      # Recreate component_overviews table
      create_table :component_overviews do |t|
        t.bigint :website_id, null: false
        t.bigint :page_id
        t.string :component_type
        t.string :name
        t.string :path
        t.bigint :component_id
        t.bigint :file_specification_id
        t.string :purpose
        t.string :context
        t.string :copy
        t.string :background_color
        t.integer :sort_order
        t.timestamps
      end
      add_index :component_overviews, :created_at
      add_index :component_overviews, :file_specification_id
      add_index :component_overviews, :name
      add_index :component_overviews, :page_id
      add_index :component_overviews, :path
      add_index :component_overviews, :website_id

      # Recreate component_content_plans table
      create_table :component_content_plans do |t|
        t.bigint :component_overview_id, null: false
        t.string :component_type
        t.jsonb :data, default: {}, null: false
        t.integer :component_id
        t.timestamps
      end
      add_index :component_content_plans, :component_overview_id
      add_index :component_content_plans, :created_at

      # Recreate views with file_specification_id
      execute <<~SQL
        CREATE VIEW public.code_files AS
        WITH merged_files AS (
          SELECT wf.website_id,
            wf.path,
            wf.content,
            wf.content_tsv,
            wf.embedding,
            wf.shasum,
            wf.file_specification_id,
            wf.created_at,
            wf.updated_at,
            'WebsiteFile'::text AS source_type,
            wf.id AS source_id
          FROM public.website_files wf
          UNION ALL
          SELECT w.id AS website_id,
            tf.path,
            tf.content,
            tf.content_tsv,
            tf.embedding,
            tf.shasum,
            tf.file_specification_id,
            tf.created_at,
            tf.updated_at,
            'TemplateFile'::text AS source_type,
            tf.id AS source_id
          FROM (public.template_files tf
            JOIN public.websites w ON ((w.template_id = tf.template_id)))
          WHERE (NOT (EXISTS (SELECT 1
            FROM public.website_files wf2
            WHERE ((wf2.website_id = w.id) AND ((wf2.path)::text = (tf.path)::text)))))
        )
        SELECT website_id,
          path,
          content,
          content_tsv,
          embedding,
          shasum,
          file_specification_id,
          source_type,
          source_id,
          created_at,
          updated_at
        FROM merged_files
        ORDER BY website_id, path;
      SQL

      execute <<~SQL
        CREATE VIEW public.code_file_histories AS
        WITH merged_files AS (
          SELECT wfh.website_id,
            wfh.snapshot_id,
            wfh.path,
            wfh.content,
            wfh.content_tsv,
            wfh.shasum,
            wfh.file_specification_id,
            wfh.created_at,
            wfh.updated_at,
            'WebsiteFile'::text AS source_type,
            wfh.website_file_id AS source_id
          FROM public.website_file_histories wfh
          UNION ALL
          SELECT wh.website_id,
            wh.snapshot_id,
            tf.path,
            tf.content,
            tf.content_tsv,
            tf.shasum,
            tf.file_specification_id,
            tf.created_at,
            tf.updated_at,
            'TemplateFile'::text AS source_type,
            tf.id AS source_id
          FROM ((public.template_files tf
            JOIN public.websites w ON ((w.template_id = tf.template_id)))
            JOIN public.website_histories wh ON (((wh.website_id = w.id) AND (wh.snapshot_id IS NOT NULL))))
          WHERE (NOT (EXISTS (SELECT 1
            FROM public.website_file_histories wfh2
            WHERE ((wfh2.website_id = wh.website_id) AND ((wfh2.snapshot_id)::text = (wh.snapshot_id)::text) AND ((wfh2.path)::text = (tf.path)::text)))))
        )
        SELECT website_id,
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
end
