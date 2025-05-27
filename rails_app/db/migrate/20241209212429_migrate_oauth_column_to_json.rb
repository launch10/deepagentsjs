class MigrateOauthColumnToJson < ActiveRecord::Migration[8.0]
  def up
    safety_assured do 
      change_column :connected_accounts, :auth, :jsonb, using: "auth::jsonb"
    end
  end

  def down
    safety_assured do
      change_column :connected_accounts, :auth, :text, using: "auth::text"
    end
  end
end
