# == Schema Information
#
# Table name: credit_transactions
#
#  id                              :bigint           not null, primary key
#  amount_millicredits             :bigint           not null
#  balance_after_millicredits      :bigint           not null
#  credit_type                     :string           not null
#  idempotency_key                 :string
#  metadata                        :jsonb
#  pack_balance_after_millicredits :bigint           not null
#  plan_balance_after_millicredits :bigint           not null
#  reason                          :string           not null
#  reference_type                  :string
#  transaction_type                :string           not null
#  created_at                      :datetime         not null
#  updated_at                      :datetime         not null
#  account_id                      :bigint           not null
#  reference_id                    :string
#
# Indexes
#
#  index_credit_transactions_on_account_id_and_created_at        (account_id,created_at)
#  index_credit_transactions_on_idempotency_key                  (idempotency_key) UNIQUE WHERE (idempotency_key IS NOT NULL)
#  index_credit_transactions_on_reference_type_and_reference_id  (reference_type,reference_id)
#
class CreditTransaction < ApplicationRecord
  TRANSACTION_TYPES = %w[allocate consume purchase refund gift adjust expire].freeze
  CREDIT_TYPES = %w[plan pack split].freeze

  REASONS = %w[
    ai_generation
    plan_renewal
    plan_credits_expired
    plan_upgrade
    plan_downgrade
    pack_purchase
    gift
    refund
  ].freeze

  belongs_to :account

  # Allow tests to skip sequence validation when testing with arbitrary balance values
  attr_accessor :skip_sequence_validation

  validates :transaction_type, presence: true, inclusion: {in: TRANSACTION_TYPES}
  validates :credit_type, presence: true, inclusion: {in: CREDIT_TYPES}
  validates :reason, presence: true
  validates :amount_millicredits, presence: true
  validates :balance_after_millicredits, presence: true
  validates :plan_balance_after_millicredits, presence: true
  validates :pack_balance_after_millicredits, presence: true
  validate :balance_components_sum_to_total, unless: :skip_sequence_validation
  validate :balance_sequence_is_valid, on: :create, unless: :skip_sequence_validation

  after_create :update_account_balances

  scope :for_account, ->(account) { where(account: account) }
  scope :allocations, -> { where(transaction_type: "allocate") }
  scope :consumptions, -> { where(transaction_type: "consume") }
  scope :expirations, -> { where(transaction_type: "expire") }

  def self.latest_for_account(account)
    for_account(account).order(created_at: :desc).first
  end

  def amount=(credits)
    self.amount_millicredits = Millicredits.from_credits(credits)
  end

  def balance_after=(credits)
    self.balance_after_millicredits = Millicredits.from_credits(credits)
  end

  def plan_balance_after=(credits)
    self.plan_balance_after_millicredits = Millicredits.from_credits(credits)
  end

  def pack_balance_after=(credits)
    self.pack_balance_after_millicredits = Millicredits.from_credits(credits)
  end

  # Display wrapper methods - return credits (millicredits / 1000)
  # Note: 1 credit = 1 cent, so these values equal cents
  def amount
    Millicredits.to_credits(amount_millicredits)
  end

  def balance_after
    Millicredits.to_credits(balance_after_millicredits)
  end

  def plan_balance_after
    Millicredits.to_credits(plan_balance_after_millicredits)
  end

  def pack_balance_after
    Millicredits.to_credits(pack_balance_after_millicredits)
  end

  # Explicit cents helpers (1000 millicredits = 1 cent)
  # These are aliases for the credit methods since 1 credit = 1 cent
  alias_method :amount_cents, :amount
  alias_method :balance_after_cents, :balance_after
  alias_method :plan_balance_after_cents, :plan_balance_after
  alias_method :pack_balance_after_cents, :pack_balance_after

  def amount_credits
    amount_millicredits / 1000.0
  end

  def credit?
    amount_millicredits.positive?
  end

  def debit?
    amount_millicredits.negative?
  end

  private

  def update_account_balances
    # Use update! instead of update_columns so this participates in the
    # transaction and rolls back properly if the transaction fails
    account.update!(
      plan_millicredits: plan_balance_after_millicredits,
      pack_millicredits: pack_balance_after_millicredits,
      total_millicredits: balance_after_millicredits
    )
  end

  # Validates that plan + pack = total
  def balance_components_sum_to_total
    return if plan_balance_after_millicredits.nil? || pack_balance_after_millicredits.nil? || balance_after_millicredits.nil?

    expected_total = plan_balance_after_millicredits + pack_balance_after_millicredits
    if balance_after_millicredits != expected_total
      errors.add(:balance_after_millicredits, "must equal plan_balance_after_millicredits + pack_balance_after_millicredits (expected #{expected_total}, got #{balance_after_millicredits})")
    end
  end

  # Validates that this transaction follows correctly from the previous one
  # This catches bugs where balances drift due to calculation errors
  def balance_sequence_is_valid
    return if account.nil? || amount_millicredits.nil?

    # Find the previous transaction for this account
    # Order by created_at DESC, id DESC to handle same-second transactions (e.g., expire + allocate)
    previous = account.credit_transactions
      .where.not(id: id)
      .order(created_at: :desc, id: :desc)
      .limit(1)
      .first

    if previous
      validate_sequence_from_previous(previous)
    else
      validate_first_transaction
    end
  end

  def validate_sequence_from_previous(previous)
    # Total balance should follow: previous.balance_after_millicredits + amount_millicredits
    expected_total = previous.balance_after_millicredits + amount_millicredits
    if balance_after_millicredits != expected_total
      errors.add(:balance_after_millicredits, "sequence error: expected #{expected_total} (#{previous.balance_after_millicredits} + #{amount_millicredits}), got #{balance_after_millicredits}")
    end

    # Plan/pack balance should follow based on credit_type
    case credit_type
    when "plan"
      validate_plan_only_sequence(previous)
    when "pack"
      validate_pack_only_sequence(previous)
    when "split"
      validate_split_sequence(previous)
    end
  end

  def validate_plan_only_sequence(previous)
    expected_plan = previous.plan_balance_after_millicredits + amount_millicredits
    if plan_balance_after_millicredits != expected_plan
      errors.add(:plan_balance_after_millicredits, "sequence error: expected #{expected_plan}, got #{plan_balance_after_millicredits}")
    end

    if pack_balance_after_millicredits != previous.pack_balance_after_millicredits
      errors.add(:pack_balance_after_millicredits, "should not change for plan transaction (expected #{previous.pack_balance_after_millicredits}, got #{pack_balance_after_millicredits})")
    end
  end

  def validate_pack_only_sequence(previous)
    expected_pack = previous.pack_balance_after_millicredits + amount_millicredits
    if pack_balance_after_millicredits != expected_pack
      errors.add(:pack_balance_after_millicredits, "sequence error: expected #{expected_pack}, got #{pack_balance_after_millicredits}")
    end

    if plan_balance_after_millicredits != previous.plan_balance_after_millicredits
      errors.add(:plan_balance_after_millicredits, "should not change for pack transaction (expected #{previous.plan_balance_after_millicredits}, got #{plan_balance_after_millicredits})")
    end
  end

  def validate_split_sequence(previous)
    plan_change = plan_balance_after_millicredits - previous.plan_balance_after_millicredits
    pack_change = pack_balance_after_millicredits - previous.pack_balance_after_millicredits

    if plan_change + pack_change != amount_millicredits
      errors.add(:base, "split: plan_change (#{plan_change}) + pack_change (#{pack_change}) must equal amount_millicredits (#{amount_millicredits})")
    end

    # For consumption (negative amount), both changes should be <= 0
    if amount_millicredits.negative? && (plan_change > 0 || pack_change > 0)
      errors.add(:base, "split consumption cannot increase balances")
    end
  end

  def validate_first_transaction
    # First transaction for this account
    # For credits (positive amount): balance should equal amount
    # For debits (negative amount): this would be unusual for first transaction
    if amount_millicredits.positive?
      if credit_type == "plan" && plan_balance_after_millicredits != amount_millicredits
        errors.add(:plan_balance_after_millicredits, "first transaction: expected #{amount_millicredits} for plan credit, got #{plan_balance_after_millicredits}")
      elsif credit_type == "pack" && pack_balance_after_millicredits != amount_millicredits
        errors.add(:pack_balance_after_millicredits, "first transaction: expected #{amount_millicredits} for pack credit, got #{pack_balance_after_millicredits}")
      end
    end

    # The "other" balance should be 0 for first transaction (unless split)
    if credit_type == "plan" && pack_balance_after_millicredits != 0
      errors.add(:pack_balance_after_millicredits, "first transaction: pack balance should be 0, got #{pack_balance_after_millicredits}")
    elsif credit_type == "pack" && plan_balance_after_millicredits != 0
      errors.add(:plan_balance_after_millicredits, "first transaction: plan balance should be 0, got #{plan_balance_after_millicredits}")
    end
    # Note: "split" type doesn't have the same first transaction constraints
  end
end
