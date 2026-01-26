# frozen_string_literal: true

class RenameCostMicrocentsToCostMillicredits < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_column :llm_usage, :cost_microcents, :cost_millicredits
    end
  end
end
