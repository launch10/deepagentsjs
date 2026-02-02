class DocumentResource < Madmin::Resource
  menu parent: "Content"

  # Attributes
  attribute :id, form: false
  attribute :title
  attribute :slug
  attribute :status
  attribute :document_type
  attribute :source_type
  attribute :source_url
  attribute :last_synced_at, form: false
  attribute :created_at, form: false
  attribute :updated_at, form: false

  # Associations
  attribute :chunks, form: false

  def self.display_name(record)
    record.title
  end

  def self.default_sort_column
    "updated_at"
  end

  def self.default_sort_direction
    "desc"
  end
end
