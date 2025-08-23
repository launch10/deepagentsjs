Zhong.redis = Redis.new(url: ENV["REDIS_URL"])

def est_time(time)
  ActiveSupport::TimeZone.new("America/New_York").parse(time).utc
end

Zhong.schedule do
  category "cloudflare" do
    every(5.minutes, "monitor domains") do
      Domain.monitor_domains
    end
  end
end