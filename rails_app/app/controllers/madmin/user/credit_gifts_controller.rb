# frozen_string_literal: true

module Madmin
  module User
    class CreditGiftsController < Madmin::ApplicationController
      def index
        @user = ::User.find(params[:user_id])
        gifts = @user.owned_account.credit_gifts.order(created_at: :desc).includes(:admin)
        pagy, records = pagy(gifts, limit: 10)

        render json: {
          gifts: records.map { |g|
            {
              id: g.id,
              amount: g.amount,
              reason: g.reason,
              notes: g.notes,
              credits_allocated: g.credits_allocated,
              admin_name: g.admin.name,
              created_at: g.created_at.iso8601
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
        @gift = CreditGift.new(gift_params.merge(
          account: @user.owned_account,
          admin: true_user
        ))

        if @gift.save
          redirect_to main_app.madmin_user_path(@user), notice: "Gift of #{@gift.amount} credits created."
        else
          redirect_to main_app.madmin_user_path(@user), alert: @gift.errors.full_messages.to_sentence
        end
      end

      private

      def gift_params
        params.require(:credit_gift).permit(:amount, :reason, :notes)
      end
    end
  end
end
