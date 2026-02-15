# Fails a deploy for the first project, optionally with a support ticket.
#
# Usage:
#   await appScenario('fail_deploy', { email, with_ticket: true })
#   await appScenario('fail_deploy', { email, with_ticket: false })
#
# Options:
#   email: string - User's email to find account
#   with_ticket: boolean - Whether to create a support ticket (default: true)

email = command_options[:email] || command_options["email"]
with_ticket = command_options.fetch(:with_ticket, command_options.fetch("with_ticket", true))

user = User.find_by!(email: email)
account = user.owned_account
project = account.projects.first!

# Create or find a deploy in failed state
deploy = project.deploys.order(created_at: :desc).first
if deploy
  deploy.update!(status: "failed", stacktrace: "Website deploy failed: build error")
else
  deploy = project.deploys.create!(
    status: "failed",
    stacktrace: "Website deploy failed: build error"
  )
end

ticket_reference = nil
if with_ticket
  Deploys::AutoSupportTicketService.new(deploy).call
  deploy.reload
  ticket_reference = deploy.support_request&.ticket_reference
end

logger.info "[fail_deploy] deploy=#{deploy.id} status=#{deploy.status} ticket=#{ticket_reference}"

{
  deploy_id: deploy.id,
  status: deploy.status,
  ticket_reference: ticket_reference
}
