# Returns the first project from the database
# Useful for getting the project UUID after restoring a snapshot
#
# Usage: await appQuery('first_project')
# Returns: { id: number, uuid: string, name: string }

project = Project.first
raise "No projects found in database" unless project

{ id: project.id, uuid: project.uuid, name: project.name }
