class RemoveUniqueConstraintFromAccountsName < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    safety_assured do
      remove_index :accounts, name: :index_accounts_on_name
      add_index :accounts, :name, algorithm: :concurrently
    end
  end
end
