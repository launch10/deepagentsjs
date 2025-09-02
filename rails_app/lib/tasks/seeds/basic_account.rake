namespace :seeds do
  desc "Create a basic account"
  task basic_account: :environment do
    user = User.find_or_initialize_by(
      email: "brett@abeverything.com",
    )
    user.update(
      password: "password",
      password_confirmation: "password",
      first_name: "Basic",
      last_name: "Account",
      terms_of_service: true,
      confirmed_at: Time.current
    )

    # Account is automatically created via after_create callback
    account = user.owned_account
    
    # Set up payment processor for the account
    # Use fake_processor for development/testing
    account.set_payment_processor :stripe, allow_fake: true
    
    # Subscribe to a plan
    plan = Plan.last
    
    # Create subscription through the payment processor
    unless account.plan&.present?
      subscription = account.payment_processor.subscribe(
        plan: plan.stripe_id,
        ends_at: nil # No end date, ongoing subscription
      )
      puts "Subscription: #{subscription.processor_plan} (Status: #{subscription.status})"
    end
    
    puts "Created user: #{user.email}"
    puts "Account: #{account.name} (ID: #{account.id})"

    thread_id = SecureRandom.uuid
    project = Project.find_or_initialize_by(
      name: "My Great Site",
      account: account,
    )
    project.update(
      thread_id: thread_id,
    )

    website = Website.find_or_initialize_by(
      name: "My Great Site",
      account: account,
    )
    website.update(
      thread_id: thread_id,
      project: project,
      template: Template.first
    )
    
    domain = Domain.find_or_initialize_by(
      domain: "example.abeverything.com",
    )
    domain.update(
      website: website,
      account: account
    )
    website.make_fixture_files

    puts "Created project: #{project.name}"
    puts "Created website: #{website.name}"
    puts "Created domain: #{domain.domain}"
  end
end