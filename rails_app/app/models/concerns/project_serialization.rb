module ProjectSerialization
  def to_mini_json
    {
      project_name: name,
      thread_id: thread_id
    }
  end
end
