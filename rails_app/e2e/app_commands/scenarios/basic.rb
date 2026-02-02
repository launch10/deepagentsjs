# Basic scenario - placeholder for common test setup
# Usage: await appScenario('basic', options)
#
# This scenario is a template. For Launch10, most tests restore a database
# snapshot first, then layer scenarios on top. This file can be customized
# for any common setup that doesn't fit in a snapshot.
#
# Example usage:
#   await appScenario('basic', { email: 'test@example.com' })

# Return empty hash if no setup needed
{}
