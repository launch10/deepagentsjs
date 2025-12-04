class BrainstormFinished < BaseBuilder
  def base_snapshot
    "brainstorm_created"
  end

  def output_name
    "brainstorm_finished"
  end

  def build
    brainstorm = Brainstorm.last
    brainstorm.update!(
      idea: "A scheduling tool that automatically finds meeting times across teams in different time zones. Eliminates the back-and-forth of calendar coordination.",
      audience: "Remote teams and distributed companies struggling with scheduling meetings across continents. Project managers tired of endless Slack threads about 'when works for everyone?'",
      solution: "Connect your calendar, share your availability preferences, and we handle the rest—suggesting optimal times that work for everyone instantly. Your team just clicks yes.",
      social_proof: "Used by 2,000+ distributed teams who've cut meeting coordination time by 80%. Companies like TechCorp save 15 hours per week on scheduling alone."
    )

    puts "Finished brainstorm: #{brainstorm.id}"
  end
end
