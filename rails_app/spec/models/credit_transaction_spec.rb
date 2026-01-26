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
require "rails_helper"

RSpec.describe CreditTransaction, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:account) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:transaction_type) }
    it { is_expected.to validate_presence_of(:credit_type) }
    it { is_expected.to validate_presence_of(:reason) }
    it { is_expected.to validate_presence_of(:amount) }
    it { is_expected.to validate_presence_of(:balance_after) }
    it { is_expected.to validate_presence_of(:plan_balance_after) }
    it { is_expected.to validate_presence_of(:pack_balance_after) }

    it { is_expected.to validate_inclusion_of(:transaction_type).in_array(%w[allocate consume purchase refund gift adjust expire]) }
    it { is_expected.to validate_inclusion_of(:credit_type).in_array(%w[plan pack]) }
  end

  describe "callbacks" do
    describe "#update_account_balances" do
      let(:account) { create(:account) }

      it "updates account cached columns after create" do
        expect(account.plan_credits).to eq(0)
        expect(account.pack_credits).to eq(0)
        expect(account.total_credits).to eq(0)

        create(:credit_transaction, :skip_validation,
          account: account,
          plan_balance_after: 5000,
          pack_balance_after: 100,
          balance_after: 5100)

        account.reload
        expect(account.plan_credits).to eq(5000)
        expect(account.pack_credits).to eq(100)
        expect(account.total_credits).to eq(5100)
      end

      it "updates account for all transaction types" do
        %w[allocate consume purchase refund gift adjust expire].each do |tx_type|
          account = create(:account)

          create(:credit_transaction, :skip_validation,
            account: account,
            transaction_type: tx_type,
            amount: ((tx_type == "expire") ? -100 : 100),
            plan_balance_after: 1000,
            pack_balance_after: 200,
            balance_after: 1200)

          account.reload
          expect(account.plan_credits).to eq(1000), "Failed for transaction_type: #{tx_type}"
          expect(account.pack_credits).to eq(200), "Failed for transaction_type: #{tx_type}"
          expect(account.total_credits).to eq(1200), "Failed for transaction_type: #{tx_type}"
        end
      end
    end
  end

  describe "scopes" do
    let(:account) { create(:account) }

    describe ".for_account" do
      let!(:tx1) { create(:credit_transaction, :skip_validation, account: account) }
      let!(:tx2) { create(:credit_transaction, :skip_validation) }

      it "filters by account" do
        expect(described_class.for_account(account)).to contain_exactly(tx1)
      end
    end

    describe ".allocations" do
      let!(:allocation) { create(:credit_transaction, :skip_validation, account: account, transaction_type: "allocate") }
      let!(:consumption) { create(:credit_transaction, :skip_validation, account: account, transaction_type: "consume") }

      it "returns only allocations" do
        expect(described_class.allocations).to contain_exactly(allocation)
      end
    end

    describe ".consumptions" do
      let!(:allocation) { create(:credit_transaction, :skip_validation, account: account, transaction_type: "allocate") }
      let!(:consumption) { create(:credit_transaction, :skip_validation, account: account, transaction_type: "consume") }

      it "returns only consumptions" do
        expect(described_class.consumptions).to contain_exactly(consumption)
      end
    end
  end

  describe ".latest_for_account" do
    let(:account) { create(:account) }

    context "when account has transactions" do
      let!(:old_tx) { create(:credit_transaction, :skip_validation, account: account, created_at: 1.day.ago) }
      let!(:new_tx) { create(:credit_transaction, :skip_validation, account: account, created_at: Time.current) }

      it "returns the most recent transaction" do
        expect(described_class.latest_for_account(account)).to eq(new_tx)
      end
    end

    context "when account has no transactions" do
      it "returns nil" do
        expect(described_class.latest_for_account(account)).to be_nil
      end
    end
  end

  describe "#credit?" do
    it "returns true for positive amounts" do
      tx = build(:credit_transaction, amount: 100)
      expect(tx).to be_credit
    end

    it "returns false for negative amounts" do
      tx = build(:credit_transaction, amount: -100)
      expect(tx).not_to be_credit
    end
  end

  describe "#debit?" do
    it "returns true for negative amounts" do
      tx = build(:credit_transaction, amount: -100)
      expect(tx).to be_debit
    end

    it "returns false for positive amounts" do
      tx = build(:credit_transaction, amount: 100)
      expect(tx).not_to be_debit
    end
  end

  describe "balance sequence validation" do
    let(:account) { create(:account) }

    describe "#balance_components_sum_to_total" do
      it "is valid when plan + pack = total" do
        tx = build(:credit_transaction,
          account: account,
          amount: 1000,
          plan_balance_after: 800,
          pack_balance_after: 200,
          balance_after: 1000)
        tx.skip_sequence_validation = true # only skip sequence, not sum validation
        expect(tx).to be_valid
      end

      it "is invalid when plan + pack != total" do
        tx = build(:credit_transaction,
          account: account,
          amount: 1000,
          plan_balance_after: 800,
          pack_balance_after: 200,
          balance_after: 900) # wrong!
        expect(tx).not_to be_valid
        expect(tx.errors[:balance_after]).to include(match(/must equal plan_balance_after \+ pack_balance_after/))
      end
    end

    describe "#balance_sequence_is_valid" do
      context "for first transaction on account" do
        it "is valid with correct balances for plan credit" do
          tx = build(:credit_transaction,
            account: account,
            transaction_type: "allocate",
            credit_type: "plan",
            amount: 1000,
            plan_balance_after: 1000,
            pack_balance_after: 0,
            balance_after: 1000)

          expect(tx).to be_valid
        end

        it "is valid with correct balances for pack credit" do
          tx = build(:credit_transaction,
            account: account,
            transaction_type: "purchase",
            credit_type: "pack",
            reason: "pack_purchase",
            amount: 500,
            plan_balance_after: 0,
            pack_balance_after: 500,
            balance_after: 500)

          expect(tx).to be_valid
        end

        it "is invalid when plan balance doesn't match amount for first plan transaction" do
          tx = build(:credit_transaction,
            account: account,
            transaction_type: "allocate",
            credit_type: "plan",
            amount: 1000,
            plan_balance_after: 800, # wrong!
            pack_balance_after: 0,
            balance_after: 800)

          expect(tx).not_to be_valid
          expect(tx.errors[:plan_balance_after]).to include(match(/first transaction: expected 1000/))
        end

        it "is invalid when pack balance is not 0 for first plan transaction" do
          tx = build(:credit_transaction,
            account: account,
            transaction_type: "allocate",
            credit_type: "plan",
            amount: 1000,
            plan_balance_after: 1000,
            pack_balance_after: 100, # wrong!
            balance_after: 1100)

          expect(tx).not_to be_valid
          expect(tx.errors[:pack_balance_after]).to include(match(/first transaction: pack balance should be 0/))
        end
      end

      context "for subsequent transactions" do
        let!(:first_tx) do
          create(:credit_transaction,
            account: account,
            transaction_type: "allocate",
            credit_type: "plan",
            amount: 1000,
            plan_balance_after: 1000,
            pack_balance_after: 0,
            balance_after: 1000)
        end

        it "is valid when balances follow correctly from previous for plan transaction" do
          tx = build(:credit_transaction,
            account: account,
            transaction_type: "consume",
            credit_type: "plan",
            reason: "ai_generation",
            amount: -200,
            plan_balance_after: 800,
            pack_balance_after: 0,
            balance_after: 800)

          expect(tx).to be_valid
        end

        it "is invalid when total balance doesn't follow sequence" do
          tx = build(:credit_transaction,
            account: account,
            transaction_type: "consume",
            credit_type: "plan",
            reason: "ai_generation",
            amount: -200,
            plan_balance_after: 800,
            pack_balance_after: 0,
            balance_after: 900) # wrong! should be 800

          expect(tx).not_to be_valid
          expect(tx.errors[:balance_after]).to include(match(/sequence error: expected 800/))
        end

        it "is invalid when plan balance doesn't follow sequence" do
          tx = build(:credit_transaction,
            account: account,
            transaction_type: "consume",
            credit_type: "plan",
            reason: "ai_generation",
            amount: -200,
            plan_balance_after: 700, # wrong! should be 800
            pack_balance_after: 0,
            balance_after: 700)

          expect(tx).not_to be_valid
          expect(tx.errors[:plan_balance_after]).to include(match(/sequence error: expected 800/))
        end

        it "is invalid when pack balance changes for plan transaction" do
          tx = build(:credit_transaction,
            account: account,
            transaction_type: "consume",
            credit_type: "plan",
            reason: "ai_generation",
            amount: -200,
            plan_balance_after: 800,
            pack_balance_after: 100, # wrong! should stay 0
            balance_after: 900)

          expect(tx).not_to be_valid
          expect(tx.errors[:pack_balance_after]).to include(match(/should not change for plan transaction/))
        end

        context "with pack credits" do
          let!(:pack_tx) do
            create(:credit_transaction,
              account: account,
              transaction_type: "purchase",
              credit_type: "pack",
              reason: "pack_purchase",
              amount: 500,
              plan_balance_after: 1000, # unchanged from first_tx
              pack_balance_after: 500,
              balance_after: 1500)
          end

          it "is valid when pack balance follows correctly" do
            tx = build(:credit_transaction,
              account: account,
              transaction_type: "consume",
              credit_type: "pack",
              reason: "ai_generation",
              amount: -100,
              plan_balance_after: 1000, # unchanged
              pack_balance_after: 400,
              balance_after: 1400)

            expect(tx).to be_valid
          end

          it "is invalid when plan balance changes for pack transaction" do
            tx = build(:credit_transaction,
              account: account,
              transaction_type: "consume",
              credit_type: "pack",
              reason: "ai_generation",
              amount: -100,
              plan_balance_after: 900, # wrong! should stay 1000
              pack_balance_after: 400,
              balance_after: 1300)

            expect(tx).not_to be_valid
            expect(tx.errors[:plan_balance_after]).to include(match(/should not change for pack transaction/))
          end
        end
      end
    end

    describe "skip_sequence_validation" do
      it "skips validation when attribute is set" do
        tx = build(:credit_transaction,
          account: account,
          amount: 1000,
          plan_balance_after: 500, # wrong for first tx
          pack_balance_after: 100, # wrong for first tx
          balance_after: 600)
        tx.skip_sequence_validation = true

        expect(tx).to be_valid
      end

      it "skips validation when using factory trait" do
        tx = build(:credit_transaction, :skip_validation,
          account: account,
          amount: 1000,
          plan_balance_after: 500,
          pack_balance_after: 100,
          balance_after: 600)

        expect(tx).to be_valid
      end
    end
  end
end
