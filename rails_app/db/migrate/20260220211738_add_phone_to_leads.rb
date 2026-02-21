class AddPhoneToLeads < ActiveRecord::Migration[8.0]
  def change
    add_column :leads, :phone, :string, limit: 50
  end
end
