class AddTemplateToWebsites < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_reference :websites, :template, null: true, index: {algorithm: :concurrently}
  end
end
