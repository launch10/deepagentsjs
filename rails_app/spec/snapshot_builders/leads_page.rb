class LeadsPage < BaseBuilder
  def base_snapshot
    "website_step"
  end

  def output_name
    "leads_page"
  end

  def build
    account = Account.first
    project = account.projects.first
    website = project.website

    # Create 25 leads for pagination testing (20 per page = 2 pages)
    # Include some with null names
    25.times do |i|
      name = (i % 5 == 0) ? nil : Faker::Name.name
      lead = Lead.create!(
        account: account,
        name: name,
        email: "lead#{i + 1}@example.com"
      )

      WebsiteLead.create!(
        lead: lead,
        website: website,
        created_at: (25 - i).hours.ago
      )

      puts "Created lead #{i + 1}: #{lead.email} (name: #{name || "NULL"})"
    end

    puts "Total leads for project: #{project.leads_count}"
  end
end
