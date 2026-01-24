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
  TRANSACTION_TYPES = %w[allocate consume purchase refund gift adjust].freeze
  CREDIT_TYPES = %w[plan pack].freeze

  belongs_to :account

  validates :transaction_type, presence: true, inclusion: { in: TRANSACTION_TYPES }
  validates :credit_type, presence: true, inclusion: { in: CREDIT_TYPES }
  validates :reason, presence: true
  validates :amount, presence: true
  validates :balance_after, presence: true
  validates :plan_balance_after, presence: true
  validates :pack_balance_after, presence: true

  scope :for_account, ->(account) { where(account: account) }
  scope :allocations, -> { where(transaction_type: "allocate") }
  scope :consumptions, -> { where(transaction_type: "consume") }

  def self.latest_for_account(account)
    for_account(account).order(created_at: :desc).first
  end

  def credit?
    amount.positive?
  end

  def debit?
    amount.negative?
  end
end
