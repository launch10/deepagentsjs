# frozen_string_literal: true

class CreditGiftResource < Madmin::Resource
  menu parent: "Credits"

  # Attributes
  attribute :id, form: false
  attribute :amount
  attribute :reason
  attribute :notes
  attribute :credits_allocated, form: false
  attribute :created_at, form: false
  attribute :updated_at, form: false

  # Associations
  attribute :account
  attribute :admin, form: false

  # Only show create form fields - no editing after creation (ledger is append-only)
  def self.actions
    [:index, :show, :new, :create]
  end

  def self.display_name(record)
    "Gift ##{record.id} - #{record.amount} credits to #{record.account&.name}"
  end

  def self.default_sort_column
    "created_at"
  end

  def self.default_sort_direction
    "desc"
  end
end
