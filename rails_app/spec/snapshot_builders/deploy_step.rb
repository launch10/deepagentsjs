class DeployStep < BaseBuilder
  def base_snapshot
    "campaign_review_step"
  end

  def output_name
    "deploy_step"
  end

  def build
    account = Account.first
    raise "Account not found" unless account

    user = account.owner
    raise "User not found" unless user

    project = account.projects.first
    raise "No project found for account #{account.id}" unless project

    # Set up Google OAuth connected account
    user.connected_accounts.where(provider: "google_oauth2").destroy_all
    user.connected_accounts.create!(
      provider: "google_oauth2",
      uid: "123456789",
      access_token: "mock_token",
      refresh_token: "mock_refresh",
      expires_at: 1.day.from_now,
      auth: {
        "info" => {
          "email" => "test@launch10.ai",
          "name" => "Test User"
        }
      }
    )

    # Create pending deploy
    project.deploys.create!(status: "pending")

    puts "Created deploy_step snapshot"
    puts "  - User: #{user.email}"
    puts "  - Google email: #{account.google_email_address}"
    puts "  - Project: #{project.name} (ID: #{project.id})"
    puts "  - Deploy status: pending"
  end
end
