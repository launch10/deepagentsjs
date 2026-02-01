class WebsiteStep < BaseBuilder
  def base_snapshot
    "basic_account"
  end

  def output_name
    "website_step"
  end

  def build
    account = Account.first
    unless account
      user = create(:user, name: "Test User")
      account = user.owned_account
    end

    project = account.projects.first
    if project.nil?
      data = Brainstorm.create_brainstorm!(account, name: "Test Project", thread_id: SecureRandom.uuid)

      brainstorm = data[:brainstorm]
      brainstorm.update!(
        idea: "A scheduling tool that automatically finds meeting times across teams in different time zones. Eliminates the back-and-forth of calendar coordination.",
        audience: "Remote teams and distributed companies struggling with scheduling meetings across continents. Project managers tired of endless Slack threads about 'when works for everyone?'",
        solution: "Connect your calendar, share your availability preferences, and we handle the rest—suggesting optimal times that work for everyone instantly. Your team just clicks yes.",
        social_proof: "Used by 2,000+ distributed teams who've cut meeting coordination time by 80%. Companies like TechCorp save 15 hours per week on scheduling alone."
      )
      project = data[:project]
    else
      brainstorm = project.brainstorm
    end

    website = project.website

    # Assign a theme to the website (uses first official theme from core_data seed)
    theme = Theme.where(theme_type: "official").first
    if theme
      website.update!(theme_id: theme.id)
      puts "Assigned theme: #{theme.name} (ID: #{theme.id})"
    else
      puts "WARNING: No official themes found - theme not assigned"
    end

    # Create uploads (logo + images) and associate with website
    # Use actual CDN URLs that OpenAI can access (files already exist on dev-uploads.launch10.ai)
    cdn_images = [
      { file: "21b36cfc-f657-471f-8256-d36bea9689fc.png", is_logo: true },
      { file: "024dfc6c-335d-4f11-883b-f8e241f91744.png", is_logo: false }
    ]

    cdn_images.each_with_index do |img, i|
      upload = Upload.new(
        account: account,
        is_logo: img[:is_logo],
        media_type: "image",
        original_filename: img[:file]
      )
      # Set file column directly (bypasses CarrierWave upload processing)
      upload[:file] = img[:file]
      upload.save!(validate: false)
      WebsiteUpload.create!(website: website, upload: upload)
      puts "Created #{img[:is_logo] ? "logo" : "image"} upload #{i + 1}: #{upload.id} (#{img[:file]})"
    end

    project.current_workflow.update!(step: "website") # Ready to do website builder

    # Create domains with website_urls for testing domain picker
    create_domains_with_urls(account, website)

    puts "Created website with brainstorm: #{brainstorm.id}"
    puts "Website ID: #{website.id}, Theme ID: #{website.theme_id}"
    puts "Total uploads for website: #{website.uploads.count}"
  end

  private

  def create_domains_with_urls(account, _main_website)
    # NOTE: We use Domain.new + save!(validate: false) to bypass the subdomain limit
    # validation. This allows us to create test domains regardless of plan limits.

    # 1. Platform subdomain - unassigned (no website yet)
    # Useful for testing "assign existing domain to current website"
    domain1 = Domain.new(
      account: account,
      website: nil,
      domain: "scheduling-tool.launch10.site",
      is_platform_subdomain: true
    )
    domain1.save!(validate: false)
    puts "Created unassigned platform subdomain: #{domain1.domain} (ID: #{domain1.id})"

    # # 2. Platform subdomain assigned to a DIFFERENT website with multiple paths
    # # Useful for testing path conflicts and domain with existing urls
    # # Use Brainstorm.create_brainstorm! which creates project + website + brainstorm together
    # other_data = Brainstorm.create_brainstorm!(account, name: "Meeting Tool Project", thread_id: SecureRandom.uuid)
    # other_website = other_data[:website]
    # other_website.update!(name: "Meeting Tool")
    # other_data[:brainstorm].update!(
    #   idea: "Team meeting scheduler",
    #   audience: "Remote teams",
    #   solution: "Easy meeting scheduling"
    # )

    # domain2 = Domain.new(
    #   account: account,
    #   website: other_website,
    #   domain: "meeting-tool.launch10.site",
    #   is_platform_subdomain: true
    # )
    # domain2.save!(validate: false)

    # # Add website_urls to domain2 (multiple paths)
    # WebsiteUrl.create!(domain: domain2, website: other_website, account: account, path: "/")
    # WebsiteUrl.create!(domain: domain2, website: other_website, account: account, path: "/landing")
    # puts "Created platform subdomain with website: #{domain2.domain} (ID: #{domain2.id})"
    # puts "  - website: #{other_website.name} (ID: #{other_website.id})"
    # puts "  - paths: /, /landing"

    # # 3. Custom domain (not platform subdomain) - unassigned
    # # Useful for testing custom domain scenarios
    # domain3 = Domain.new(
    #   account: account,
    #   website: nil,
    #   domain: "my-custom-site.com",
    #   is_platform_subdomain: false
    # )
    # domain3.save!(validate: false)
    # puts "Created custom domain: #{domain3.domain} (ID: #{domain3.id})"
  end
end
