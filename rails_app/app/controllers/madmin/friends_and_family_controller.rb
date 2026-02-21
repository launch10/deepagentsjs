# frozen_string_literal: true

module Madmin
  class FriendsAndFamilyController < Madmin::ApplicationController
    def index
      users = ff_users.includes(:owned_account).order(created_at: :desc)

      render inertia: "Madmin/FriendsAndFamily/Index", props: {
        users: users.map { |u| serialize_user(u) }
      }
    end

    def create
      service = ::FriendsAndFamily::InviteService.new(admin: true_user)
      result = service.call(
        email: invite_params[:email],
        name: invite_params[:name],
        credits: invite_params[:credits].to_i
      )

      if result.success?
        redirect_to main_app.madmin_friends_and_family_index_path, notice: "Invitation sent to #{invite_params[:email]}"
      else
        redirect_to main_app.madmin_friends_and_family_index_path, alert: result.error
      end
    end

    def resend
      user = ::User.find(params[:id])
      reset_token = generate_reset_token(user)

      ::FriendsAndFamily::InvitationMailer.with(
        admin: true_user,
        user: user,
        reset_token: reset_token,
        credits: 0
      ).invite.deliver_later

      redirect_to main_app.madmin_friends_and_family_index_path, notice: "Invitation resent to #{user.email}"
    end

    def revoke
      user = ::User.find(params[:id])
      account = user.owned_account

      if account&.payment_processor&.subscribed?
        account.payment_processor.subscription.cancel_now!
        redirect_to main_app.madmin_friends_and_family_index_path, notice: "Subscription revoked for #{user.email}"
      else
        redirect_to main_app.madmin_friends_and_family_index_path, alert: "#{user.email} has no active subscription"
      end
    end

    private

    def ff_users
      ff_plan = Plan.find_by(name: "friends_family")
      return ::User.none unless ff_plan

      ::User.joins(owned_account: {payment_processor: :subscriptions})
        .where(pay_subscriptions: {processor_plan: ff_plan.fake_processor_id, status: "active"})
    end

    def invite_params
      params.require(:friends_and_family).permit(:email, :name, :credits)
    end

    def generate_reset_token(user)
      raw_token, hashed_token = Devise.token_generator.generate(::User, :reset_password_token)
      user.update!(
        reset_password_token: hashed_token,
        reset_password_sent_at: Time.current
      )
      raw_token
    end

    def serialize_user(user)
      account = user.owned_account
      {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at&.iso8601,
        has_logged_in: user.remember_created_at.present? || (user.reset_password_sent_at.present? && user.reset_password_token.nil?),
        pack_credits: account&.pack_credits.to_f,
        total_credits: account&.total_credits.to_f
      }
    end
  end
end
