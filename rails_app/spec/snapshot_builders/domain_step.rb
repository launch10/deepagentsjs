class DomainStep < BaseBuilder
  def base_snapshot
    "website_generated"
  end

  def output_name
    "domain_step"
  end

  def build
    account = Account.first
    project = account.projects.first
    website = project.website

    domain = create(:domain, account: account, domain: "test-project.launch10.site")
    create(:website_url, website: website, domain: domain, account: account, path: "/")

    puts "Created domain_step snapshot"
    puts "  - Domain: #{domain.domain}"
    puts "  - Website URL: #{website.reload.website_url.full_url}"
  end
end
