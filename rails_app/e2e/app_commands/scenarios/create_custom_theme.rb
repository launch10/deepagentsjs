# Creates a custom (community) theme for testing
# Usage: await appScenario('create_custom_theme', { name, colors })
#
# Options:
#   name: string - Theme name (default: "Test Custom Theme")
#   colors: Array<string> - 5 hex colors
#
# Returns:
#   { id, name, colors }

name = command_options[:name] || command_options["name"] || "Test Custom Theme"
colors = command_options[:colors] || command_options["colors"]

raise "colors is required" unless colors

account = Account.first!

# Setting author automatically sets theme_type to "community"
# The before_save callback computes theme, pairings, and typography_recommendations
theme = Theme.create!(
  name: name,
  colors: colors,
  author: account
)

logger.info "[create_custom_theme] Created theme #{theme.id} (#{name})"

{
  id: theme.id,
  name: theme.name,
  colors: theme.colors
}
