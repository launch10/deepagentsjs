# frozen_string_literal: true

module Madmin
  module User
    class CreditTransactionsController < Madmin::ApplicationController
      def index
        @user = ::User.find(params[:user_id])

        respond_to do |format|
          format.html do
            render inertia: "Madmin/Users/CreditTransactions", props: {
              user: {id: @user.id, name: @user.name}
            }
          end
          format.json do
            transactions = @user.owned_account.credit_transactions.order(created_at: :desc)
            pagy, records = pagy(transactions, limit: 20)

            render json: {
              transactions: records.map { |t|
                {
                  id: t.id,
                  transaction_type: t.transaction_type,
                  credit_type: t.credit_type,
                  reason: t.reason,
                  amount: t.amount,
                  balance_after: t.balance_after,
                  plan_balance_after: t.plan_balance_after,
                  pack_balance_after: t.pack_balance_after,
                  reference_type: t.reference_type,
                  reference_id: t.reference_id,
                  created_at: t.created_at.iso8601
                }
              },
              pagination: {
                current_page: pagy.page,
                total_pages: pagy.pages,
                total_count: pagy.count,
                prev_page: pagy.prev,
                next_page: pagy.next
              }
            }
          end
        end
      end
    end
  end
end
