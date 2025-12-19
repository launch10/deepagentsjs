class CreateWebsiteUrls < ActiveRecord::Migration[8.0]
  def change
    create_table :website_urls do |t|
      t.references :website, foreign_key: true, null: false
      t.references :domain, foreign_key: true, null: false
      t.references :account, foreign_key: true, null: false
      t.string :path, null: false, default: "/"
      t.timestamps
    end

    add_index :website_urls, [:domain_id, :path], unique: true
  end
end
