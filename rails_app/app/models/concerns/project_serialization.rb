module ProjectSerialization
  def to_mini_json
    {
      project_name: name,
      thread_id: thread_id,
      created_at: created_at,
      updated_at: updated_at
    }
  end
end
