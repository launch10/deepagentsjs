# Time manipulation via Timecop
# Usage from Playwright:
#   await timecop.freeze('2024-01-01 12:00:00');
#   await timecop.travel('2024-01-01');
#   await timecop.return();

require "timecop"

if command_options[:freeze]
  time = Time.zone.parse(command_options[:freeze])
  Timecop.freeze(time)
  logger.info "Timecop: frozen at #{time}"
  { frozen_at: time.iso8601 }
elsif command_options[:travel]
  time = Time.zone.parse(command_options[:travel])
  Timecop.travel(time)
  logger.info "Timecop: traveled to #{time}"
  { traveled_to: time.iso8601 }
elsif command_options[:return]
  Timecop.return
  logger.info "Timecop: returned to real time"
  { returned: true }
else
  raise "Unknown timecop command. Use freeze, travel, or return."
end
