class WebsiteFinished < BaseBuilder
  def base_snapshot
    "brainstorm_finished"
  end

  def output_name
    "website_finished"
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

    ExampleWebsites.find("launch-proof").files.reject(&:binary?).each do |file|
      website.website_files.create!(
        path: file.relative_path,
        content: file.content
      )
    end

    domain = website.domains.first || create(:domain, website: website, account: account, domain: "example.launch10.site")
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
