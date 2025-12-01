class AddEmbeddingToWebsiteFileHistories < ActiveRecord::Migration[8.0]
  def change
    add_column :website_file_histories, :embedding, :vector, limit: 1536
  end
end
