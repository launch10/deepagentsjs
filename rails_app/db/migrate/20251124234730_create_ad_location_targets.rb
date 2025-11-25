class CreateAdLocationTargets < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_location_targets do |t|
      t.bigint :campaign_id
      t.string :target_type, null: false # geo_location, radius, location_group
      t.boolean :targeted, null: false, default: true

      t.string :location_identifier # e.g. US-NY-NYC or POSTAL-10001
      t.string :location_name # Human readable: New York City, New York, United States
      t.string :location_type # e.g. COUNTRY, REGION, CITY, POSTAL

      t.decimal :latitude, precision: 10, scale: 6
      t.decimal :longitude, precision: 10, scale: 6
      t.decimal :radius, precision: 10, scale: 2
      t.string :radius_units # MILES, KILOMETERS

      # Full address for radius
      t.string :address_line_1
      t.string :city
      t.string :state
      t.string :postal_code
      t.string :country_code

      t.jsonb :platform_settings, default: { google: {}, meta: {} }

      t.timestamps

      t.index :campaign_id
      t.index :location_identifier
      t.index :platform_settings, using: :gin
    end
  end
end
