class ValidateForeignKeyOnJobRunsAccount < ActiveRecord::Migration[8.0]
  def change
    validate_foreign_key :job_runs, :accounts
  end
end
