class RefactorLeadsToAccountScopedWithWebsiteLeads < ActiveRecord::Migration[8.0]
  def change
    # Create website_leads join table
    # No foreign keys - using bigints with indexes for pgsync compatibility
    create_table :website_leads do |t|
      t.bigint :lead_id, null: false
      t.bigint :website_id, null: false
      t.bigint :visit_id
      t.string :visitor_token
      t.string :gclid

      t.timestamps
    end

    add_index :website_leads, :lead_id
    add_index :website_leads, :website_id
    add_index :website_leads, :visit_id
    add_index :website_leads, [:lead_id, :website_id], unique: true
    add_index :website_leads, :visitor_token
    add_index :website_leads, :gclid

    # Update leads: remove project-scoped columns, add account-scoped
    remove_index :leads, :project_id
    remove_index :leads, [:project_id, :email]
    remove_index :leads, :visit_id
    remove_index :leads, :visitor_token
    remove_index :leads, :gclid

    safety_assured do
      remove_column :leads, :project_id, :bigint
      remove_column :leads, :visit_id, :bigint
      remove_column :leads, :visitor_token, :string
      remove_column :leads, :gclid, :string
    end

    add_column :leads, :account_id, :bigint, null: false
    safety_assured do
      add_index :leads, :account_id
      add_index :leads, [:account_id, :email], unique: true
    end
  end
end
