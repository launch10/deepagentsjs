# frozen_string_literal: true

module FriendsAndFamily
  class InvitationMailer < ApplicationMailer
    def invite
      @admin = params[:admin]
      @user = params[:user]
      @reset_token = params[:reset_token]
      @credits = params[:credits]
      @reset_url = edit_user_password_url(reset_password_token: @reset_token)

      mail(
        to: @user.email,
        subject: "#{@admin.name} has invited you to test Launch10"
      )
    end
  end
end
