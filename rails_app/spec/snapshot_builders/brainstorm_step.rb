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

    # Seed brainstorm checkpoint so Langgraph recognises the project
    seed_brainstorm_checkpoint(
      thread_id: data[:chat].thread_id,
      website_id: data[:website].id,
      brainstorm_id: data[:brainstorm].id,
      project_id: data[:project].id,
      chat_id: data[:chat].id
    )
  end

  private

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

    puts "Seeded brainstorm checkpoint for thread #{thread_id}"
  end
end
