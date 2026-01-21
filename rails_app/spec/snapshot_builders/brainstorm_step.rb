class BrainstormStep < BaseBuilder
  def base_snapshot
    "basic_account"
  end

  def output_name
    "brainstorm_step"
  end

  def build
    account = Account.first
    unless account
      user = create(:user, name: "Test User")
      account = user.owned_account
    end

    data = Brainstorm.create_brainstorm!(account, name: "Test Project", thread_id: SecureRandom.uuid)
    project = data[:project]
    website = project.website

    puts "Created website with brainstorm: #{brainstorm.id}"
    puts "Website ID: #{website.id}, Theme ID: #{website.theme_id}"
  end
end