class WebsiteDeployed < BaseBuilder
  def base_snapshot
    "deploy_step"
  end

  def output_name
    "website_deployed"
  end

  def build
    account = Account.first
    project = account.projects.first
    website = project.website

    # Create 25 leads for pagination testing (20 per page = 2 pages)
    # Include some with null names
    leads = 25.times.map do |i|
      name = (i % 5 == 0) ? nil : Faker::Name.name
      lead = Lead.create!(
        account: account,
        name: name,
        email: "lead#{i + 1}@example.com"
      )

      WebsiteLead.new(
        lead: lead,
        website: website,
        created_at: (25 - i).hours.ago
      )
    end
    WebsiteLead.import(leads)

    puts "Total leads for project: #{project.leads_count}"
  end
end
