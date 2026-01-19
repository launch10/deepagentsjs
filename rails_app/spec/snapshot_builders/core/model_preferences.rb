module Core
  class ModelPreferences < BaseBuilder
    def seed
      puts "Seeding model preferences..."

      ActiveRecord::Base.connection_handler.clear_all_connections!
      ActiveRecord::Base.establish_connection

      # Default preferences matching langgraph_app/app/core/llm/core.ts
      # Free tier uses local models only
      free_prefs = [
        # Blazing speed
        {cost_tier: "free", speed_tier: "blazing", skill: "planning", model_keys: %w[gpt_oss]},
        {cost_tier: "free", speed_tier: "blazing", skill: "writing", model_keys: %w[gpt_oss]},
        {cost_tier: "free", speed_tier: "blazing", skill: "coding", model_keys: %w[gpt_oss]},
        {cost_tier: "free", speed_tier: "blazing", skill: "reasoning", model_keys: %w[gpt_oss]},
        # Fast
        {cost_tier: "free", speed_tier: "fast", skill: "planning", model_keys: %w[gpt_oss]},
        {cost_tier: "free", speed_tier: "fast", skill: "writing", model_keys: %w[gpt_oss]},
        {cost_tier: "free", speed_tier: "fast", skill: "coding", model_keys: %w[gpt_oss]},
        {cost_tier: "free", speed_tier: "fast", skill: "reasoning", model_keys: %w[gpt_oss]},
        # Slow
        {cost_tier: "free", speed_tier: "slow", skill: "planning", model_keys: %w[gpt_oss]},
        {cost_tier: "free", speed_tier: "slow", skill: "writing", model_keys: %w[gpt_oss]},
        {cost_tier: "free", speed_tier: "slow", skill: "coding", model_keys: %w[gpt_oss]},
        {cost_tier: "free", speed_tier: "slow", skill: "reasoning", model_keys: %w[gpt_oss]}
      ]

      # Paid tier uses API models with fallbacks
      paid_prefs = [
        # Blazing speed - speed is priority
        {cost_tier: "paid", speed_tier: "blazing", skill: "planning", model_keys: %w[groq haiku haiku3]},
        {cost_tier: "paid", speed_tier: "blazing", skill: "writing", model_keys: %w[groq haiku haiku3]},
        {cost_tier: "paid", speed_tier: "blazing", skill: "coding", model_keys: %w[groq haiku haiku3]},
        {cost_tier: "paid", speed_tier: "blazing", skill: "reasoning", model_keys: %w[groq haiku haiku3]},
        # Fast - fast models first
        {cost_tier: "paid", speed_tier: "fast", skill: "planning", model_keys: %w[sonnet haiku gpt5]},
        {cost_tier: "paid", speed_tier: "fast", skill: "writing", model_keys: %w[haiku haiku3 gpt5_mini]},
        {cost_tier: "paid", speed_tier: "fast", skill: "coding", model_keys: %w[haiku sonnet gpt5]},
        {cost_tier: "paid", speed_tier: "fast", skill: "reasoning", model_keys: %w[haiku sonnet gpt5]},
        # Slow - quality is priority
        {cost_tier: "paid", speed_tier: "slow", skill: "planning", model_keys: %w[opus sonnet haiku gpt5 haiku3 groq]},
        {cost_tier: "paid", speed_tier: "slow", skill: "writing", model_keys: %w[sonnet haiku gpt5 haiku3 groq]},
        {cost_tier: "paid", speed_tier: "slow", skill: "coding", model_keys: %w[opus sonnet haiku gpt5 haiku3 groq]},
        {cost_tier: "paid", speed_tier: "slow", skill: "reasoning", model_keys: %w[opus sonnet haiku gpt5 haiku3 groq]}
      ]

      all_prefs = free_prefs + paid_prefs

      # Use upsert to handle existing records
      all_prefs.each do |pref_attrs|
        ModelPreference.find_or_initialize_by(
          cost_tier: pref_attrs[:cost_tier],
          speed_tier: pref_attrs[:speed_tier],
          skill: pref_attrs[:skill]
        ).tap do |pref|
          pref.model_keys = pref_attrs[:model_keys]
          pref.save!
        end
      end

      puts "Model preferences seeded: #{ModelPreference.count} preferences"
    end
  end
end
