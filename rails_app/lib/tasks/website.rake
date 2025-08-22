namespace :website do
  desc "Create a website with fixture files for development/testing"
  task create_with_fixtures: :environment do
    # Find or create a user
    user = User.first || User.create!(
      email: "test@example.com",
      password: "password123",
      password_confirmation: "password123",
      name: "Test User"
    )
    
    # Find or create an account
    account = Account.first || Account.create!(
      name: "Test Account"
    )
    
    # Find or create a project
    project = Project.first || Project.create!(
      name: "Test Project",
      thread_id: "thread_#{SecureRandom.hex(8)}",
      account: account
    )
    
    # Find or create a template (optional)
    template = Template.find_by(name: "default")
    
    # Create the website
    website = Website.create!(
      name: "Fixture Website",
      thread_id: "thread_#{SecureRandom.hex(8)}",
      user: user,
      project: project,
      template: template
    )
    
    # Add fixture files
    website.make_fixture_files
    
    puts "Created website '#{website.name}' (ID: #{website.id})"
    puts "  User: #{user.email}"
    puts "  Project: #{project.name}"
    puts "  Template: #{template&.name || 'none'}"
    puts "  Files: #{website.website_files.count} website files"
    puts "  Total files (with template): #{website.files.count}"
  end
  
  desc "List all website files (including template inheritance)"
  task :list_files, [:website_id] => :environment do |task, args|
    website = Website.find(args[:website_id])
    
    puts "Website: #{website.name} (ID: #{website.id})"
    puts "Template: #{website.template&.name || 'none'}"
    puts "\nFiles (#{website.files.count} total):"
    
    website.files.each do |file|
      source = file.is_a?(WebsiteFile) ? "website" : "template"
      puts "  [#{source}] #{file.path}"
    end
  end
end