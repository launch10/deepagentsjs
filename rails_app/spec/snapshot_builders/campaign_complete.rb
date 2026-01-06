class CampaignComplete < BaseBuilder
  def base_snapshot
    "campaign_review_step"
  end

  def output_name
    "campaign_complete"
  end

  def build
    account = Account.first
    raise "No account found" unless account

    create_google_connected_account(account)

    # We can mark complete at some future point, not sure what this will look like yet
    # For now, just ensure the account exists
    puts "Campaign complete snapshot built successfully"
  end

  def create_google_connected_account(account)
    user = account.owner
    raise "No owner found for account #{account.id}" unless user

    return if user.connected_accounts.exists?(provider: "google_oauth2")

    create(:connected_account, :google, owner: user, auth: {
      "info" => {
        "email" => "brett@launch10.ai",
        "name" => user.name
      }
    })
  end
end
