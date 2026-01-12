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
    test_image_path = Rails.root.join("spec/fixtures/files/test_image.jpg")

    # Create a logo
    logo_upload = Upload.create!(
      account: account,
      file: Rack::Test::UploadedFile.new(test_image_path, "image/jpeg"),
      is_logo: true
    )
    WebsiteUpload.create!(website: website, upload: logo_upload)
    puts "Created logo upload: #{logo_upload.id}"

    # Create a few regular images
    3.times do |i|
      image_upload = Upload.create!(
        account: account,
        file: Rack::Test::UploadedFile.new(test_image_path, "image/jpeg"),
        is_logo: false
      )
      WebsiteUpload.create!(website: website, upload: image_upload)
      puts "Created image upload #{i + 1}: #{image_upload.id}"
    end

    project.current_workflow.update!(step: "website") # Ready to do website builder

    puts "Created website with brainstorm: #{brainstorm.id}"
    puts "Website ID: #{website.id}, Theme ID: #{website.theme_id}"
    puts "Total uploads for website: #{website.uploads.count}"
  end
end
