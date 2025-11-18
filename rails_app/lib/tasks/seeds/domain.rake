namespace :seeds do
  desc "Create a basic account"
  task project: :environment do
    account = Account.first

    thread_id = SecureRandom.uuid
    project = Project.find_or_initialize_by(
      name: "My Great Site",
      account: account
    )
    project.update(
      thread_id: thread_id
    )
    website = Website.find_or_initialize_by(
      name: "My Great Site",
      account: account
    )
    website.update(
      thread_id: thread_id,
      project: project,
      template: Template.first
    )

    domain = Domain.find_or_initialize_by(
      domain: "example.launch10.ai"
    )
    domain.update(
      website: website,
      account: account
    )
    website.make_fixture_files

    puts "Created project: #{project.name}"
    puts "Created website: #{website.name}"
    puts "Created domain: #{domain.domain}"
  end
end
