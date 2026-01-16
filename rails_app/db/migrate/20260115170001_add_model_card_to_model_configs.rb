class AddModelCardToModelConfigs < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    safety_assured do
      add_column :model_configs, :model_card, :string
    end

    reversible do |dir|
      dir.up do
        # Populate model_card based on model_key
        model_cards = {
          "opus" => "claude-opus-4-5",
          "sonnet" => "claude-sonnet-4-5",
          "haiku" => "claude-haiku-4-5",
          "groq" => "openai/gpt-oss-120b",
          "gpt5" => "gpt-5",
          "gpt5_mini" => "gpt-5-mini",
          "gemini_flash" => "gemini-1.5-flash-latest"
        }

        safety_assured do
          model_cards.each do |key, card|
            execute "UPDATE model_configs SET model_card = '#{card}' WHERE model_key = '#{key}'"
          end
        end
      end
    end

    safety_assured do
      add_index :model_configs, :model_card, algorithm: :concurrently
    end
  end
end
