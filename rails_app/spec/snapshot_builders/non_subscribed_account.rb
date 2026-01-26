class NonSubscribedAccount < BaseBuilder
  def base_snapshot
    "core_data"
  end

  def output_name
    "non_subscribed_account"
  end

  def build
    create_non_subscribed_user
  end

  def create_non_subscribed_user
    # Create test user without a subscription
    user = User.find_or_initialize_by(email: "test_user@launch10.ai")
    user.assign_attributes(
      password: "Launch10TestPass!",
      password_confirmation: "Launch10TestPass!",
      first_name: "Non-Subscribed",
      last_name: "User",
      terms_of_service: true,
      confirmed_at: Time.current
    )
    user.save!

    account = user.owned_account
    # Set up payment processor but don't create a subscription
    account.set_payment_processor :fake_processor, allow_fake: true

    puts "Created non-subscribed user: #{user.email}"
    puts "Account: #{account.name} (ID: #{account.id})"
    puts "Has subscription: #{account.payment_processor&.subscribed?}"
  end
end
