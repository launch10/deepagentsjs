class AddJtiToUsers < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :users, :jti, :string
    User.all.each do |user|
      user.update_column(:jti, SecureRandom.uuid)
    end
    safety_assured do 
      change_column_null :users, :jti, false
    end
    add_index :users, :jti, unique: true, algorithm: :concurrently
  end
end
