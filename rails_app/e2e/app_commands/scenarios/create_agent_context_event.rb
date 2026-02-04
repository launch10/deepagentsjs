# Creates an agent context event for testing
# Usage: await appScenario('create_agent_context_event', { project_id, event_type, payload })
#
# Options:
#   project_id: number - The project ID
#   event_type: string - Event type (e.g., "images.created", "images.deleted")
#   payload: object - Optional event payload (default: {})
#
# Returns:
#   { id, event_type, payload, created_at }

project_id = command_options[:project_id] || command_options["project_id"]
event_type = command_options[:event_type] || command_options["event_type"]
payload = command_options[:payload] || command_options["payload"] || {}

raise "project_id is required" unless project_id
raise "event_type is required" unless event_type

project = Project.find(project_id)
account = project.account

event = account.agent_context_events.create!(
  project: project,
  event_type: event_type,
  payload: payload
)

logger.info "[create_agent_context_event] Created event #{event.id} (#{event_type}) for project #{project_id}"

{
  id: event.id,
  event_type: event.event_type,
  payload: event.payload,
  created_at: event.created_at.iso8601
}
