class RemoveThreadIdFromProjects < ActiveRecord::Migration[8.0]
  def change
    safety_assured { remove_column :projects, :thread_id, :string }
  end
end
