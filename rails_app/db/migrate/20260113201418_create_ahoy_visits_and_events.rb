class CreateAhoyVisitsAndEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :ahoy_visits do |t|
      t.string :visit_token
      t.string :visitor_token

      t.bigint :website_id
      t.string :gclid

      # standard
      t.string :ip
      t.text :user_agent
      t.text :referrer
      t.string :referring_domain
      t.text :landing_page

      # technology
      t.string :browser
      t.string :os
      t.string :device_type

      # location
      t.string :country
      t.string :region
      t.string :city
      t.float :latitude
      t.float :longitude

      # utm parameters
      t.string :utm_source
      t.string :utm_medium
      t.string :utm_term
      t.string :utm_content
      t.string :utm_campaign

      # native apps
      t.string :app_version
      t.string :os_version
      t.string :platform

      t.datetime :started_at

      t.index [:visitor_token, :started_at]
      t.index :visit_token, unique: true
      t.index :website_id
      t.index :gclid
    end

    create_table :ahoy_events do |t|
      t.bigint :visit_id

      t.string :name
      t.jsonb :properties
      t.datetime :time

      t.index :visit_id
      t.index [:name, :time]
      t.index :properties, using: :gin, opclass: :jsonb_path_ops
    end
  end
end
