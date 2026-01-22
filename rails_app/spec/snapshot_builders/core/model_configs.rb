module Core
  class ModelConfigs < BaseBuilder
    def seed
      puts "Seeding model configs..."

      ActiveRecord::Base.connection_handler.clear_all_connections!
      ActiveRecord::Base.establish_connection

      model_configs = [
        {model_key: "opus", model_card: "claude-opus-4-5", enabled: false, max_usage_percent: 80, cost_in: 5.0, cost_out: 25.0, cache_writes: 10.00, cache_reads: 0.50},
        {model_key: "sonnet", model_card: "claude-sonnet-4-5", enabled: true, max_usage_percent: 90, cost_in: 3.0, cost_out: 15.0, cache_writes: 6.00, cache_reads: 0.30},
        {model_key: "haiku", model_card: "claude-haiku-4-5", enabled: true, max_usage_percent: 95, cost_in: 1.0, cost_out: 5.0, cache_writes: 2.00, cache_reads: 0.10},
        {model_key: "haiku3", model_card: "claude-3-5-haiku-latest", enabled: true, max_usage_percent: 100, cost_in: 0.80, cost_out: 4.00, cache_writes: 1.60, cache_reads: 0.08 },
        {model_key: "gpt_oss", model_card: "openai/gpt-oss-120b", enabled: true, max_usage_percent: 90, cost_in: 0.15, cost_out: 0.60, cache_writes: nil, cache_reads: nil},
        {model_key: "gpt5_mini", model_card: "gpt-5-mini", enabled: true, max_usage_percent: 100, cost_in: 0.25, cost_out: 2.0, cache_writes: nil, cache_reads: nil}
      ]

      ModelConfig.import(model_configs, on_duplicate_key_update: {conflict_target: :model_key})

      puts "Model configs seeded: #{ModelConfig.count} configs"
    end
  end
end
