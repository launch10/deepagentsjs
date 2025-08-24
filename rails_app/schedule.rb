require_relative "config/environment"

Zhong.redis = Redis.new(url: ENV["REDIS_URL"])

def est_time(time)
  ActiveSupport::TimeZone.new("America/New_York").parse(time).utc
end

Zhong.schedule do
  category "cloudflare" do
    every(1.minutes, "monitor domains") do
      Domain.monitor_domains
    end

    every(1.day, at: '1:00 am') do
      PartitionMaintenanceWorker.perform_async
    end
  end
end