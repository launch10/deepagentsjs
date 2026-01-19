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

    project = account.projects.first
    project.current_workflow.next_step!

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
