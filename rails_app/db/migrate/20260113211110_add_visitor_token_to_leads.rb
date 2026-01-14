class AddVisitorTokenToLeads < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :leads, :visitor_token, :string
    add_index :leads, :visitor_token, algorithm: :concurrently

    add_column :leads, :gclid, :string
    add_index :leads, :gclid, algorithm: :concurrently
  end
end
