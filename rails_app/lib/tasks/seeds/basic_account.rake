namespace :seed do
  desc "Create a basic account"
  task basic_account: :environment do
    user = User.create!(
      email: "basic_account4@example.com",
      password: "password",
      password_confirmation: "password",
      name: "Basic Account",
      terms_of_service: true
    )

    project = Project.create!(
      name: "My Great Site",
      user: user
    )

    website = Website.create!(
      name: "My Great Site",
      user: user,
      thread_id: "123",
      project: project
    )
    
    plan = Plan.last
    
  end
end