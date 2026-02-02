class RemoveWebsiteIdFromDomains < ActiveRecord::Migration[8.0]
  def change
    # Safety: Domain model no longer references website_id
    # (belongs_to :website removed, no code uses this column)
    safety_assured do
      remove_index :domains, :website_id, if_exists: true
      remove_column :domains, :website_id, :bigint
    end
  end
end
