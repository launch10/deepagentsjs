class PlanTierResource < Madmin::Resource
  menu parent: "Payments", position: 1

  # Attributes
  attribute :id, form: false
  attribute :name
  attribute :description
  attribute :details
  attribute :created_at, form: false
  attribute :updated_at, form: false

  def self.display_name(record)
    record.display_name
  end
end
