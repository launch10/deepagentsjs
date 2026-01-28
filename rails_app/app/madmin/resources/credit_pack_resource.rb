# frozen_string_literal: true

class CreditPackResource < Madmin::Resource
  menu parent: "Credits"

  # Attributes
  attribute :id, form: false
  attribute :name
  attribute :credits
  attribute :price_cents
  attribute :currency
  attribute :stripe_price_id
  attribute :visible
  attribute :created_at, form: false
  attribute :updated_at, form: false

  # Associations
  attribute :credit_pack_purchases, form: false

  def self.display_name(record)
    "#{record.name} (#{record.credits} credits for $#{record.price_cents / 100.0})"
  end

  def self.default_sort_column
    "credits"
  end

  def self.default_sort_direction
    "asc"
  end
end
