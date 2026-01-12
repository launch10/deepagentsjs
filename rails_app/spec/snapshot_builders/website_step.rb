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

    puts "Created website with brainstorm: #{brainstorm.id}"
    puts "Website ID: #{website.id}, Theme ID: #{website.theme_id}"
    puts "Total uploads for website: #{website.uploads.count}"
  end
end
