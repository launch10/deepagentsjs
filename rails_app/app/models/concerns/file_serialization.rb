module FileSerialization
  extend ActiveSupport::Concern

  def to_mini_json
    {
      id: id,
      path: path,
      content: content,
      file_specification_id: respond_to?(:file_specification_id) ? file_specification_id : nil,
    }
  end
end