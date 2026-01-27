# frozen_string_literal: true

class CreditTransactionResource < Madmin::Resource
  menu parent: "Credits"

  # Attributes - view only (ledger is append-only)
  attribute :id, form: false
  attribute :transaction_type, form: false
  attribute :credit_type, form: false
  attribute :reason, form: false
  attribute :amount_millicredits, form: false
  attribute :balance_after_millicredits, form: false
  attribute :plan_balance_after_millicredits, form: false
  attribute :pack_balance_after_millicredits, form: false
  attribute :idempotency_key, form: false, index: false
  attribute :reference_type, form: false, index: false
  attribute :reference_id, form: false, index: false
  attribute :metadata, form: false, index: false
  attribute :created_at, form: false
  attribute :updated_at, form: false, index: false

  # Associations
  attribute :account, form: false

  # View-only - no create/edit/delete (ledger is append-only)
  def self.actions
    [:index, :show]
  end

  def self.display_name(record)
    type = record.transaction_type.titleize
    amount = record.amount_millicredits
    sign = amount >= 0 ? "+" : ""
    "#{type}: #{sign}#{amount / 1000.0} credits"
  end

  def self.default_sort_column
    "created_at"
  end

  def self.default_sort_direction
    "desc"
  end
end
