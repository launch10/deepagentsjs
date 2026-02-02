# Returns the first website from the database
# Useful for tests that need a website ID after restoring a snapshot
#
# Usage: await appQuery('first_website')
# Returns: { id: number, name: string, project_id: number }

website = Website.first
raise "No websites found in database" unless website

{ id: website.id, name: website.name, project_id: website.project_id }
