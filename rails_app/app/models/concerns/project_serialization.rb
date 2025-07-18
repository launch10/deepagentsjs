module ProjectSerialization
  def to_mini_json
    {
      id: id,
      project_name: name,
      thread_id: thread_id,
      created_at: created_at,
      updated_at: updated_at
    }
  end
end
