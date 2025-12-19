class WebsiteDeployed < BaseBuilder
  def base_snapshot
    "website_created"
  end

  def output_name
    "website_deployed"
  end

  def build
    account = Account.first
    unless account
      user = create(:user, name: "Test User")
      account = user.owned_account
    end

    project = account.projects.first
    unless project
      raise "No project found for account #{account.id}"
    end

    website = project.website
    raise "No website found for project #{project.id}" unless website

    domain = website.domains.first || create(:domain, website: website, account: account)
    website_url = website.website_urls.first || create(:website_url, website: website, domain: domain, account: account)

    project.current_workflow.update!(step: "ad_campaign", substep: "content")

    puts "Advanced workflow to ad_campaign:content"
    puts "  - Account: #{account.name} (ID: #{account.id})"
    puts "  - Project: #{project.name} (ID: #{project.id})"
    puts "  - Website: #{website.id}"
    puts "  - Domain: #{domain.domain} (ID: #{domain.id})"
    puts "  - Website URL: #{website_url.domain_string}#{website_url.path} (ID: #{website_url.id})"
    puts "  - Workflow step: #{project.current_workflow.step}, substep: #{project.current_workflow.substep}"

    project
  end
end
