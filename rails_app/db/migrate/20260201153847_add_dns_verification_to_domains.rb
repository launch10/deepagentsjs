class AddDnsVerificationToDomains < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :domains, :dns_verification_status, :string, default: nil
    add_column :domains, :dns_last_checked_at, :datetime
    add_column :domains, :dns_error_message, :string
    add_index :domains, :dns_verification_status, algorithm: :concurrently
    add_index :domains, :dns_last_checked_at, algorithm: :concurrently
  end
end
