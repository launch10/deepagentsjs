# == Schema Information
#
# Table name: plans
#
#  id                :bigint           not null, primary key
#  amount            :integer          default(0), not null
#  charge_per_unit   :boolean
#  contact_url       :string
#  currency          :string
#  description       :string
#  details           :jsonb
#  hidden            :boolean
#  interval          :string           not null
#  interval_count    :integer          default(1)
#  name              :string           not null
#  trial_period_days :integer          default(0)
#  unit_label        :string
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  braintree_id      :string
#  fake_processor_id :string
#  lemon_squeezy_id  :string
#  paddle_billing_id :string
#  paddle_classic_id :string
#  plan_tier_id      :bigint
#  stripe_id         :string
#
# Indexes
#
#  index_plans_on_created_at    (created_at)
#  index_plans_on_interval      (interval)
#  index_plans_on_name          (name) UNIQUE
#  index_plans_on_plan_tier_id  (plan_tier_id)
#

class Plan < ApplicationRecord
  include Atlas::Plan
  has_prefix_id :plan

  belongs_to :plan_tier, optional: true

  # Delegate tier-level attributes
  delegate :description, :features, :credits, :display_name, to: :plan_tier, allow_nil: true
  delegate :tier_limits, :limits, to: :plan_tier, allow_nil: true

  # Backward compatibility: returns tier limits or empty relation
  def plan_limits
    plan_tier&.tier_limits || TierLimit.none
  end

  store_accessor :details, :stripe_tax
  attribute :currency, default: "usd"
  normalizes :currency, with: ->(currency) { currency.downcase }

  validates :name, :amount, :interval, presence: true
  validates :currency, presence: true, format: {with: /\A[a-zA-Z]{3}\z/, message: "must be a 3-letter ISO currency code"}
  validates :interval, inclusion: %w[month year]
  validates :trial_period_days, numericality: {only_integer: true}
  validates :unit_label, presence: {if: :charge_per_unit?}

  scope :hidden, -> { where(hidden: true) }
  scope :visible, -> { where(hidden: [nil, false]) }
  scope :monthly, -> { where(interval: :month) }
  scope :yearly, -> { where(interval: :year) }
  scope :sorted, -> { order(amount: :asc) }

  # Returns a free plan for the Fake Processor
  def self.free
    plan = where(name: "Free").first_or_initialize
    plan.update(hidden: true, amount: 0, currency: :usd, interval: :month, trial_period_days: 0, fake_processor_id: :free)
    plan
  end

  def has_trial?
    trial_period_days > 0
  end

  def monthly?
    interval == "month"
  end

  def annual?
    interval == "year"
  end
  alias_method :yearly?, :annual?

  def stripe_tax=(value)
    super(ActiveModel::Type::Boolean.new.cast(value))
  end

  def taxed?
    ActiveModel::Type::Boolean.new.cast(stripe_tax)
  end

  # Find a plan with the same name in the opposite interval
  # This is useful when letting users upgrade to the yearly plan
  def find_interval_plan
    monthly? ? annual_version : monthly_version
  end

  def annual_version
    return self if annual?
    self.class.yearly.where(name: name).first
  end
  alias_method :yearly_version, :annual_version

  def monthly_version
    return self if monthly?
    self.class.monthly.where(name: name).first
  end

  def id_for_processor(processor_name, currency: "usd")
    return if processor_name.nil?
    processor_name = :braintree if processor_name.to_s == "paypal"
    send(:"#{processor_name}_id")
  end

  # Convenience method for limit lookups
  def limit_for(limit_type)
    plan_tier&.limit_for(limit_type) || 0
  end

  # Get the usage limit for requests per month
  def monthly_request_limit
    limit_for("requests_per_month")
  end
  alias_method :usage_limit, :monthly_request_limit

  # Extract tier name from plan name (fallback if no plan_tier)
  def tier_name
    plan_tier&.name || name.gsub(/_monthly|_annual|_yearly/, "")
  end
end
