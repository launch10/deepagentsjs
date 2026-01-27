# frozen_string_literal: true

module Madmin
  class CreditGiftsController < Madmin::ApplicationController
    def create
      # Automatically set admin to the current user (true_user in case of impersonation)
      @resource = resource_class.new(resource_params.merge(admin: true_user))

      if @resource.save
        redirect_to resource_path(@resource), notice: "#{resource_class.model_name.human} was successfully created."
      else
        render :new, status: :unprocessable_entity
      end
    end

    private

    def resource_class
      CreditGift
    end

    def resource_params
      params.require(:credit_gift).permit(:account_id, :amount, :reason, :notes)
    end

    def resource_path(resource)
      madmin_credit_gift_path(resource)
    end
  end
end
