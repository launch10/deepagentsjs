class AddSupportableToSupportRequests < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_reference :support_requests, :supportable, polymorphic: true, null: true, index: {algorithm: :concurrently}
  end
end
