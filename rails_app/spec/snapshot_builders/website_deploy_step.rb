class WebsiteDeployStep < BaseBuilder
  def base_snapshot
    "domain_step"
  end

  def output_name
    "website_deploy_step"
  end

  def build
    account = Account.first
    project = account.projects.first
    website = project.website

    # Create completed WebsiteDeploy
    website_deploy = create(:website_deploy, :completed, website: website, is_live: true)

    # Create completed Deploy linked to WebsiteDeploy
    # Deploy callbacks auto-create chat, set thread_id, and stamp finished_at
    deploy = project.deploys.create!(
      status: "completed",
      is_live: true,
      website_deploy: website_deploy
    )

    # Seed Langgraph checkpoint for the deploy thread
    seed_deploy_checkpoint(
      thread_id: deploy.thread_id,
      deploy_id: deploy.id,
      website_id: website.id,
      chat_id: deploy.chat.id,
      result_url: "https://test-project.launch10.site/"
    )

    puts "Created website_deploy_step snapshot"
    puts "  - WebsiteDeploy: #{website_deploy.id} (status: #{website_deploy.status})"
    puts "  - Deploy: #{deploy.id} (status: #{deploy.status}, is_live: #{deploy.is_live})"
    puts "  - Chat: #{deploy.chat.id} (thread: #{deploy.thread_id})"
    puts "  - Deploy finished_at: #{deploy.finished_at}"
  end

  private

  def seed_deploy_checkpoint(thread_id:, deploy_id:, website_id:, chat_id:, result_url:)
    langgraph_dir = Rails.root.join("..", "langgraph_app")
    script = langgraph_dir.join("scripts", "seed-deploy-checkpoint.ts")

    cmd = [
      "cd #{langgraph_dir}",
      "npx tsx #{script}",
      "--thread-id=#{thread_id}",
      "--deploy-id=#{deploy_id}",
      "--website-id=#{website_id}",
      "--chat-id=#{chat_id}",
      "--result-url=#{result_url}"
    ].join(" ")

    result = system({"NODE_ENV" => "test"}, cmd)
    raise "Failed to seed deploy Langgraph checkpoint" unless result

    puts "Seeded deploy Langgraph checkpoint for thread #{thread_id}"
  end
end
