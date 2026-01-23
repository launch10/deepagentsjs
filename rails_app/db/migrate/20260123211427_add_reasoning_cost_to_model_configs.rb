class AddReasoningCostToModelConfigs < ActiveRecord::Migration[8.0]
  def change
    # Pricing in dollars per 1M tokens (same format as cost_in, cost_out)
    # For OpenAI o1/o3 models reasoning tokens
    add_column :model_configs, :cost_reasoning, :decimal, precision: 10, scale: 4
  end
end
