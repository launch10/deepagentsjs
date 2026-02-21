# frozen_string_literal: true

module FriendsAndFamily
  class InviteService
    Result = Struct.new(:success?, :user, :reset_token, :error, keyword_init: true)

    def initialize(admin:)
      @admin = admin
    end

    def call(email:, name:, credits:)
      validate!(email, name, credits)

      user = find_or_create_user(email, name)
      account = user.owned_account

      if account.payment_processor&.subscribed?
        return Result.new(success?: false, error: "#{email} already has a subscription")
      end

      subscribe_to_ff_plan(account)
      create_credit_gift(account, credits) if credits > 0
      reset_token = generate_reset_token(user)
      send_invitation(user, reset_token, credits)

      Result.new(success?: true, user: user, reset_token: reset_token)
    rescue ArgumentError => e
      Result.new(success?: false, error: e.message)
    end

    private

    def validate!(email, name, credits)
      raise ArgumentError, "Email can't be blank" if email.blank?
      raise ArgumentError, "Name can't be blank" if name.blank?
      raise ArgumentError, "Credits must be >= 0" if credits.negative?
    end

    def find_or_create_user(email, name)
      user = User.find_by(email: email)
      return user if user

      first_name, *last_parts = name.split(" ")
      last_name = last_parts.join(" ").presence || first_name

      User.create!(
        email: email,
        first_name: first_name,
        last_name: last_name,
        password: SecureRandom.hex(20),
        terms_of_service: true,
        confirmed_at: Time.current
      )
    end

    def subscribe_to_ff_plan(account)
      plan = Plan.find_by!(name: "friends_family")
      account.set_payment_processor(:fake_processor, allow_fake: true)
      account.payment_processor.subscribe(
        plan: plan.fake_processor_id,
        name: Pay.default_product_name,
        ends_at: nil
      )
    end

    def create_credit_gift(account, credits)
      CreditGift.create!(
        account: account,
        admin: @admin,
        amount: credits,
        reason: "beta_testing",
        notes: "Friends & family invitation"
      )
    end

    def generate_reset_token(user)
      raw_token, hashed_token = Devise.token_generator.generate(User, :reset_password_token)
      user.update!(
        reset_password_token: hashed_token,
        reset_password_sent_at: Time.current
      )
      raw_token
    end

    def send_invitation(user, reset_token, credits)
      FriendsAndFamily::InvitationMailer.with(
        admin: @admin,
        user: user,
        reset_token: reset_token,
        credits: credits
      ).invite.deliver_later
    end
  end
end
