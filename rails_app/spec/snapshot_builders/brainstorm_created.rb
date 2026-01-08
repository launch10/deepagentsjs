class BrainstormCreated < BaseBuilder
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
    end

    project.current_workflow.update!(step: "website") # Ready to do website builder

    puts "Created website with brainstorm: #{brainstorm.id}"
  end
end
