class CreateWebsiteUploads < ActiveRecord::Migration[8.0]
  def change
    create_table :website_uploads do |t|
      t.bigint :website_id, null: false
      t.bigint :upload_id, null: false

      t.index :website_id
      t.index :upload_id
    end
  end
end
