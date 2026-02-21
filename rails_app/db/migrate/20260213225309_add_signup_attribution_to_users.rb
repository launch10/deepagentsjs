class AddSignupAttributionToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :signup_attribution, :jsonb
  end
end
