class BasicAccount < BaseBuilder
  def base_snapshot
    "core_data"
  end

  def output_name
    "basic_account"
  end

  def build
    create_basic_user
    create_admin_user
  end

  def create_basic_user
    # Create basic test user
    user = User.find_or_initialize_by(email: "test_user@launch10.ai")
    user.assign_attributes(
      password: "Launch10TestPass!",
      password_confirmation: "Launch10TestPass!",
      first_name: "Basic",
      last_name: "Account",
      terms_of_service: true,
      confirmed_at: Time.current
    )
    user.save!

    account = user.owned_account
    account.set_payment_processor :fake_processor, allow_fake: true

    plan = Plan.find_by(name: "growth_monthly") || Plan.last
    raise "No plans found - core_data snapshot may be missing" unless plan

    unless account.plan&.present?
      plan.update!(fake_processor_id: "growth_monthly") unless plan.fake_processor_id.present?
      subscription = account.payment_processor.subscribe(
        plan: plan.fake_processor_id,
        ends_at: nil
      )
      puts "Subscription: #{subscription.processor_plan} (Status: #{subscription.status})"

      # Allocate plan credits (simulates what webhook handlers do in production)
      allocate_credits!(account, plan, subscription)
    end

    puts "Created user: #{user.email}"
    puts "Account: #{account.name} (ID: #{account.id})"
    puts "Credits: #{account.plan_credits} plan / #{account.pack_credits} pack / #{account.total_credits} total"
  end

  def create_admin_user
    # Create admin user
    admin_user = User.find_or_initialize_by(email: "brett@launch10.ai")
    admin_user.assign_attributes(
      password: "Launch10TestPass!",
      password_confirmation: "Launch10TestPass!",
      first_name: "Brett",
      last_name: "Shollenberger",
      terms_of_service: true,
      confirmed_at: Time.current
    )
    admin_user.save!

    # Grant system admin using JSP's method (admin field is readonly)
    Jumpstart.grant_system_admin!(admin_user)

    admin_account = admin_user.owned_account
    admin_account.set_payment_processor :fake_processor, allow_fake: true

    unless admin_account.plan&.present?
      plan = Plan.find_by(name: "growth_monthly") || Plan.last
      subscription = admin_account.payment_processor.subscribe(
        plan: plan.fake_processor_id,
        ends_at: nil
      )
      puts "Admin Subscription: #{subscription.processor_plan} (Status: #{subscription.status})"

      # Allocate plan credits (simulates what webhook handlers do in production)
      allocate_credits!(admin_account, plan, subscription)
    end

    puts "Created admin user: #{admin_user.email} (admin: #{admin_user.admin?})"
    puts "Admin Account: #{admin_account.name} (ID: #{admin_account.id})"
    puts "Admin Credits: #{admin_account.plan_credits} plan / #{admin_account.pack_credits} pack / #{admin_account.total_credits} total"
  end

  private

  # Allocates plan credits directly (bypassing webhook flow).
  # This mirrors what Credits::AllocationService does but simplified for snapshots.
  def allocate_credits!(account, plan, subscription)
    credits = plan.credits || 0
    return if credits.zero?

    account.update!(
      plan_credits: credits,
      pack_credits: 0
    )

    # Create audit trail transaction
    account.credit_transactions.create!(
      transaction_type: "allocate",
      credit_type: "plan",
      reason: "plan_renewal",
      amount: credits,
      balance_after: credits,
      plan_balance_after: credits,
      pack_balance_after: 0,
      reference_type: "Pay::Subscription",
      reference_id: subscription.id.to_s,
      idempotency_key: "snapshot:#{account.id}:#{subscription.id}"
    )
  end
end
