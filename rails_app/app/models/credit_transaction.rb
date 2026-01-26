# == Schema Information
#
# Table name: credit_transactions
#
#  id                 :bigint           not null, primary key
#  amount             :bigint           not null
#  balance_after      :bigint           not null
#  credit_type        :string           not null
#  idempotency_key    :string
#  metadata           :jsonb
#  pack_balance_after :bigint           not null
#  plan_balance_after :bigint           not null
#  reason             :string           not null
#  reference_type     :string
#  transaction_type   :string           not null
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint           not null
#  reference_id       :string
#
# Indexes
#
#  index_credit_transactions_on_account_id_and_created_at        (account_id,created_at)
#  index_credit_transactions_on_idempotency_key                  (idempotency_key) UNIQUE WHERE (idempotency_key IS NOT NULL)
#  index_credit_transactions_on_reference_type_and_reference_id  (reference_type,reference_id)
#
class CreditTransaction < ApplicationRecord
  TRANSACTION_TYPES = %w[allocate consume purchase refund gift adjust expire].freeze
  CREDIT_TYPES = %w[plan pack].freeze

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
  validates :amount, presence: true
  validates :balance_after, presence: true
  validates :plan_balance_after, presence: true
  validates :pack_balance_after, presence: true
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

  def credit?
    amount.positive?
  end

  def debit?
    amount.negative?
  end

  private

  def update_account_balances
    # Use update! instead of update_columns so this participates in the
    # transaction and rolls back properly if the transaction fails
    account.update!(
      plan_credits: plan_balance_after,
      pack_credits: pack_balance_after,
      total_credits: balance_after
    )
  end

  # Validates that plan + pack = total
  def balance_components_sum_to_total
    return if plan_balance_after.nil? || pack_balance_after.nil? || balance_after.nil?

    expected_total = plan_balance_after + pack_balance_after
    if balance_after != expected_total
      errors.add(:balance_after, "must equal plan_balance_after + pack_balance_after (expected #{expected_total}, got #{balance_after})")
    end
  end

  # Validates that this transaction follows correctly from the previous one
  # This catches bugs where balances drift due to calculation errors
  def balance_sequence_is_valid
    return if account.nil? || amount.nil?

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
    # Total balance should follow: previous.balance_after + amount
    expected_total = previous.balance_after + amount
    if balance_after != expected_total
      errors.add(:balance_after, "sequence error: expected #{expected_total} (#{previous.balance_after} + #{amount}), got #{balance_after}")
    end

    # Plan/pack balance should follow based on credit_type
    if credit_type == "plan"
      expected_plan = previous.plan_balance_after + amount
      if plan_balance_after != expected_plan
        errors.add(:plan_balance_after, "sequence error: expected #{expected_plan}, got #{plan_balance_after}")
      end

      if pack_balance_after != previous.pack_balance_after
        errors.add(:pack_balance_after, "should not change for plan transaction (expected #{previous.pack_balance_after}, got #{pack_balance_after})")
      end
    elsif credit_type == "pack"
      expected_pack = previous.pack_balance_after + amount
      if pack_balance_after != expected_pack
        errors.add(:pack_balance_after, "sequence error: expected #{expected_pack}, got #{pack_balance_after}")
      end

      if plan_balance_after != previous.plan_balance_after
        errors.add(:plan_balance_after, "should not change for pack transaction (expected #{previous.plan_balance_after}, got #{plan_balance_after})")
      end
    end
  end

  def validate_first_transaction
    # First transaction for this account
    # For credits (positive amount): balance should equal amount
    # For debits (negative amount): this would be unusual for first transaction
    if amount.positive?
      if credit_type == "plan" && plan_balance_after != amount
        errors.add(:plan_balance_after, "first transaction: expected #{amount} for plan credit, got #{plan_balance_after}")
      elsif credit_type == "pack" && pack_balance_after != amount
        errors.add(:pack_balance_after, "first transaction: expected #{amount} for pack credit, got #{pack_balance_after}")
      end
    end

    # The "other" balance should be 0 for first transaction
    if credit_type == "plan" && pack_balance_after != 0
      errors.add(:pack_balance_after, "first transaction: pack balance should be 0, got #{pack_balance_after}")
    elsif credit_type == "pack" && plan_balance_after != 0
      errors.add(:plan_balance_after, "first transaction: plan balance should be 0, got #{plan_balance_after}")
    end
  end
end
