class BasicAccount < BaseBuilder
  def base_snapshot
    "core_data"
  end

  def output_name
    "basic_account"
  end

  def build
    user = User.find_or_initialize_by(email: "test_user@launch10.ai")
    user.assign_attributes(
      password: "password",
      password_confirmation: "password",
      first_name: "Basic",
      last_name: "Account",
      terms_of_service: true,
      confirmed_at: Time.current
    )
    user.save!

    account = user.owned_account
    account.set_payment_processor :fake_processor, allow_fake: true

    plan = Plan.find_by(name: "pro") || Plan.last
    raise "No plans found - core_data snapshot may be missing" unless plan

    unless account.plan&.present?
      plan.update!(fake_processor_id: "pro_plan") unless plan.fake_processor_id.present?
      subscription = account.payment_processor.subscribe(
        plan: plan.fake_processor_id,
        ends_at: nil
      )
      puts "Subscription: #{subscription.processor_plan} (Status: #{subscription.status})"
    end

    puts "Created user: #{user.email}"
    puts "Account: #{account.name} (ID: #{account.id})"
  end
end
