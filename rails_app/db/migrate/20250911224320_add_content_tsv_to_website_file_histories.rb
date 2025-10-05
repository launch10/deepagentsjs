class AddContentTsvToWebsiteFileHistories < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!
  
  def change
    add_column :website_file_histories, :content_tsv, :tsvector
    add_index :website_file_histories, :content_tsv, using: :gin, algorithm: :concurrently, name: 'idx_website_file_histories_content_tsv'
  end
end
