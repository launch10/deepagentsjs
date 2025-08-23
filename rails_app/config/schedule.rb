# Use this file to easily define all of your cron jobs.
# https://github.com/javan/whenever
#
# It's helpful, but not entirely necessary to understand cron before proceeding.
# http://en.wikipedia.org/wiki/Cron

# Set output for logging
set :output, "log/cron.log"

# Partition Maintenance
# Run on the 25th of each month to prepare partitions for next month
every 1.month, at: '2:00 am', roles: [:db] do
  rake "partitions:ensure_partitions"
end

# Also run daily to ensure partitions exist (safety check)
every 1.day, at: '3:00 am' do
  runner "PartitionMaintenanceWorker.perform_async"
end

# Example:
#
# set :output, "/path/to/my/cron_log.log"
#
# every 2.hours do
#   command "/usr/bin/some_great_command"
#   runner "MyModel.some_method"
#   rake "some:great:rake:task"
# end
#
# every 4.days do
#   runner "AnotherModel.prune_old_records"
# end
