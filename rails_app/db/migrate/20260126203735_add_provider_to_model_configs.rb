class AddProviderToModelConfigs < ActiveRecord::Migration[8.0]
  def change
    add_column :model_configs, :provider, :string
  end
end
