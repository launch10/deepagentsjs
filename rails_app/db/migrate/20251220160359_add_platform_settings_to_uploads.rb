class AddPlatformSettingsToUploads < ActiveRecord::Migration[8.0]
  def change
    add_column :uploads, :platform_settings, :jsonb, default: { meta: {}, google: {} }
  end
end
