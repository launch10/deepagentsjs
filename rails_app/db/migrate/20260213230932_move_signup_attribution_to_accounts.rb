class MoveSignupAttributionToAccounts < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :accounts, :signup_attribution, :jsonb

      reversible do |dir|
        dir.up do
          execute <<~SQL
            UPDATE accounts
            SET signup_attribution = users.signup_attribution
            FROM users
            WHERE accounts.owner_id = users.id
              AND users.signup_attribution IS NOT NULL
          SQL
        end
      end

      remove_column :users, :signup_attribution, :jsonb
    end
  end
end
