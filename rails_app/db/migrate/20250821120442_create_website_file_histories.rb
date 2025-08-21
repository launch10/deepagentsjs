require "historiographer/postgres_migration"

class CreateWebsiteFileHistories < ActiveRecord::Migration[8.0]
  def change
    create_table :website_file_histories do |t|
      t.histories(foreign_key: :website_file_id)
    end
  end
end
