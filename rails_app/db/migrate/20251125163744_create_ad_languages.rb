class CreateAdLanguages < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_languages do |t|
      t.bigint :campaign_id
      t.jsonb :platform_settings, default: { google: {}, meta: {} }
      t.timestamps

      t.index :campaign_id
      t.index :platform_settings, using: :gin
      t.index "((platform_settings->'google'->>'criterion_id'))", name: "index_ad_languages_on_criterion_id", if_not_exists: true
      t.index "((platform_settings->'google'->>'language_constant_id'))", name: "index_ad_languages_on_language_constant_id", if_not_exists: true
    end
  end
end
