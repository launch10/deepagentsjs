class CreateModelFallbackChains < ActiveRecord::Migration[8.0]
  def change
    create_table :model_fallback_chains do |t|
      t.string :cost_tier, null: false  # "free" or "paid"
      t.string :speed_tier, null: false # "blazing", "fast", or "slow"
      t.string :skill, null: false      # "planning", "writing", "coding", or "reasoning"
      t.string :model_keys, array: true, default: [], null: false # ordered array of model_keys
      t.timestamps
    end

    add_index :model_fallback_chains, [:cost_tier, :speed_tier, :skill], unique: true, name: "idx_fallback_chains_unique"
  end
end
