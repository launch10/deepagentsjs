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
FactoryBot.define do
  factory :credit_transaction do
    association :account
    transaction_type { "allocate" }
    credit_type { "plan" }
    reason { "plan_renewal" }
    amount_millicredits { 1_000_000 }  # 1000 credits = 1,000,000 millicredits
    balance_after_millicredits { 1_000_000 }
    plan_balance_after_millicredits { 1_000_000 }
    pack_balance_after_millicredits { 0 }
    metadata { {} }

    # Trait to skip sequence validation for tests that use arbitrary balance values
    trait :skip_validation do
      skip_sequence_validation { true }
    end
  end
end
