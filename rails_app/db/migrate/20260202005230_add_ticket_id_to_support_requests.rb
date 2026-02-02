class AddTicketIdToSupportRequests < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :support_requests, :ticket_id, :string, null: false
    add_index :support_requests, :ticket_id, unique: true, algorithm: :concurrently
  end
end
