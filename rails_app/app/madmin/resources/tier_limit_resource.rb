class TierLimitResource < Madmin::Resource
  menu parent: "Payments", position: 2

  # Attributes
  attribute :id, form: false
  attribute :tier
  attribute :limit_type
  attribute :limit
  attribute :created_at, form: false
  attribute :updated_at, form: false

  def self.display_name(record)
    "#{record.tier&.name} - #{record.limit_type}"
  end
end
