class RenameModelFallbackChainsToModelPreferences < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_table :model_fallback_chains, :model_preferences
      rename_index :model_preferences, "idx_fallback_chains_unique", "idx_model_preferences_unique"
    end
  end
end
