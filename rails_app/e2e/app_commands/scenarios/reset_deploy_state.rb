# Deactivates any existing deploys and deploy chats so a fresh deploy can start.
#
# Usage: await appScenario('reset_deploy_state')
#
# This ensures the frontend's useDeployInit creates a new deploy thread
# instead of resuming an old one with stale instructions/checkpoint data.

project = Project.first
raise "No projects found" unless project

# Deactivate all existing deploys for this project
project.deploys.update_all(active: false)

# Delete CampaignDeploy and WebsiteDeploy records so change detection
# (campaign_changed? / files_changed?) treats the next deploy as fresh.
# Without this, the shasum from a previous deploy makes the graph think
# "nothing changed" and exclude Google Ads tasks entirely.
campaign = project.campaigns.first
campaign.campaign_deploys.destroy_all if campaign

website = project.website
website.deploys.destroy_all if website

# Deactivate all deploy chats for this project
Chat.where(project_id: project.id, chat_type: "deploy").update_all(active: false)

# Also clear any Langgraph checkpoints for deploy threads
# to prevent the graph from resuming old state
deploy_thread_ids = Chat.unscoped
  .where(project_id: project.id, chat_type: "deploy")
  .pluck(:thread_id)
  .compact

if deploy_thread_ids.any?
  placeholders = deploy_thread_ids.map { |id| "'#{id}'" }.join(", ")
  ActiveRecord::Base.connection.execute(
    "DELETE FROM checkpoints WHERE thread_id IN (#{placeholders})"
  )
  ActiveRecord::Base.connection.execute(
    "DELETE FROM checkpoint_writes WHERE thread_id IN (#{placeholders})"
  )
  ActiveRecord::Base.connection.execute(
    "DELETE FROM checkpoint_blobs WHERE thread_id IN (#{placeholders})"
  )
end

logger.info "[reset_deploy_state] Deactivated deploys and deploy chats for project #{project.id}"

{ status: "ok", project_id: project.id }
