class AddIndexToAccountInvitationForEmail < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def change
    add_index :account_invitations, [:account_id, :email], unique: true, algorithm: :concurrently

    # Remove redundant index
    remove_index :account_invitations, :account_id
  end
end
