require "historiographer/postgres_migration"

class CreateWebsiteHistories < ActiveRecord::Migration[8.0]
  def change
    create_table :website_histories do |t|
      t.histories(foreign_key: :website_id)
    end
  end
end
