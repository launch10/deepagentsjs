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
      # thread_id must equal project UUID so the frontend URL-based thread lookup works
      project_uuid = SecureRandom.uuid
      data = Brainstorm.create_brainstorm!(account, name: "Test Project", thread_id: project_uuid, project_attributes: { uuid: project_uuid })

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
    # Use actual CDN URLs that OpenAI can access (files already exist on dev-uploads.launch10.com)
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

    # Seed brainstorm checkpoints for all projects so Langgraph recognises them
    seed_all_brainstorm_checkpoints(account)

    puts "Created website with brainstorm: #{brainstorm.id}"
    puts "Website ID: #{website.id}, Theme ID: #{website.theme_id}"
    puts "Total uploads for website: #{website.uploads.count}"
  end

  private

  def seed_all_brainstorm_checkpoints(account)
    account.projects.each do |proj|
      bs = proj.brainstorm
      next unless bs&.chat

      seed_brainstorm_checkpoint(
        thread_id: bs.chat.thread_id,
        website_id: proj.website.id,
        brainstorm_id: bs.id,
        project_id: proj.id,
        chat_id: bs.chat.id
      )
    end
  end

  def seed_brainstorm_checkpoint(thread_id:, website_id:, brainstorm_id:, project_id:, chat_id:)
    langgraph_dir = Rails.root.join("..", "langgraph_app")
    script = langgraph_dir.join("scripts", "seed-brainstorm-checkpoint.ts")

    cmd = "cd #{langgraph_dir} && npx tsx #{script}" \
      " --thread-id=#{thread_id}" \
      " --website-id=#{website_id}" \
      " --brainstorm-id=#{brainstorm_id}" \
      " --project-id=#{project_id}" \
      " --chat-id=#{chat_id}"
    result = system({"NODE_ENV" => "test"}, cmd)

    raise "Failed to seed brainstorm checkpoint for thread #{thread_id}" unless result

    puts "Seeded brainstorm checkpoint for thread #{thread_id} (project: #{project_id})"
  end

  def create_domains_with_urls(account, _main_website)
    # NOTE: We use Domain.new + save!(validate: false) to bypass the subdomain limit
    # validation. This allows us to create test domains regardless of plan limits.
    #
    # CREDIT BALANCE: Growth plan has 2 platform subdomain credits.
    # This snapshot creates 1 platform subdomain, leaving 1 credit available
    # for testing "create new subdomain" flows.

    # 1. Platform subdomain assigned to a DIFFERENT website (root path)
    # Useful for testing path conflicts when same domain has multiple websites
    other_uuid = SecureRandom.uuid
    other_data = Brainstorm.create_brainstorm!(account, name: "Meeting Tool Project", thread_id: other_uuid, project_attributes: { uuid: other_uuid })
    other_website = other_data[:website]
    other_website.update!(name: "Meeting Tool")
    other_data[:brainstorm].update!(
      idea: "Team meeting scheduler",
      audience: "Remote teams",
      solution: "Easy meeting scheduling"
    )

    domain1 = Domain.new(
      account: account,
      domain: "meeting-tool.launch10.site",
      is_platform_subdomain: true
    )
    domain1.save!(validate: false)

    # Assign root path to the meeting tool website
    WebsiteUrl.create!(domain: domain1, website: other_website, account: account, path: "/")
    puts "Created platform subdomain with website: #{domain1.domain} (ID: #{domain1.id})"
    puts "  - website: #{other_website.name} (ID: #{other_website.id})"
    puts "  - path: /"
    puts "  - platform subdomain credits used: 1 of 2"

    # 2. Create another website using the same domain with /landing path
    # This is useful for testing path collision detection (same domain, different path, different website)
    landing_uuid = SecureRandom.uuid
    landing_data = Brainstorm.create_brainstorm!(account, name: "Landing Page Project", thread_id: landing_uuid, project_attributes: { uuid: landing_uuid })
    landing_website = landing_data[:website]
    landing_website.update!(name: "Landing Page")
    landing_data[:brainstorm].update!(
      idea: "Landing page for product",
      audience: "Visitors",
      solution: "Convert visitors to leads"
    )

    # Same domain (domain1), different path, different website
    WebsiteUrl.create!(domain: domain1, website: landing_website, account: account, path: "/landing")
    puts "Created website with /landing path: #{domain1.domain}/landing"
    puts "  - website: #{landing_website.name} (ID: #{landing_website.id})"

    # NOTE: We intentionally create only 1 platform subdomain to leave 1 credit
    # available for testing "create new subdomain" flows. The Growth plan has 2 credits.

    # 3. Custom domain (not platform subdomain) - unassigned
    # Useful for testing custom domain scenarios
    # Note: Custom domains don't count against platform subdomain limit
    domain2 = Domain.new(
      account: account,
      domain: "my-custom-site.com",
      is_platform_subdomain: false
    )
    domain2.save!(validate: false)
    puts "Created custom domain: #{domain2.domain} (ID: #{domain2.id})"
  end
end
