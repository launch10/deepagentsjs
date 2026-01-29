# frozen_string_literal: true

module Madmin
  module User
    class CreditUsageAdjustmentsController < Madmin::ApplicationController
      def index
        @user = ::User.find(params[:user_id])
        adjustments = @user.owned_account.credit_usage_adjustments.order(created_at: :desc).includes(:admin)
        pagy, records = pagy(adjustments, limit: 10)

        render json: {
          adjustments: records.map { |a|
            {
              id: a.id,
              amount: a.amount,
              reason: a.reason,
              notes: a.notes,
              credits_adjusted: a.credits_adjusted,
              admin_name: a.admin.name,
              created_at: a.created_at.iso8601
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

      def create
        @user = ::User.find(params[:user_id])
        @adjustment = CreditUsageAdjustment.new(adjustment_params.merge(
          account: @user.owned_account,
          admin: true_user
        ))

        if @adjustment.save
          redirect_to main_app.madmin_user_path(@user), notice: "Usage adjustment of #{@adjustment.amount} credits created."
        else
          redirect_to main_app.madmin_user_path(@user), alert: @adjustment.errors.full_messages.to_sentence
        end
      end

      private

      def adjustment_params
        params.require(:credit_usage_adjustment).permit(:amount, :reason, :notes)
      end
    end
  end
end
