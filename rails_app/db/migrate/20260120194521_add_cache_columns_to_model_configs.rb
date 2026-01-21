class AddCacheColumnsToModelConfigs < ActiveRecord::Migration[8.0]
  def change
    add_column :model_configs, :cache_writes, :decimal, precision: 10, scale: 4
    add_column :model_configs, :cache_reads, :decimal, precision: 10, scale: 4
  end
end
