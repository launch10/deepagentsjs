require_relative "config/environment"

Zhong.redis = Redis.new(url: ENV["REDIS_URL"])

def est_time(time)
  ActiveSupport::TimeZone.new("America/New_York").parse(time).utc
end

return if Rails.env.test?

Zhong.schedule do
  category "Cloudflare" do
    every(5.minutes, "monitor domains") do
      Domain.monitor_cloudflare_domains
    end

    every(1.day, "partition maintenance", at: '01:00') do
      Database::PartitionMaintenanceWorker.perform_async
    end

    every(1.day, "partition cleanup", at: '02:00') do
      Database::PartitionCleanupWorker.perform_async
    end
  end

  category "FAQs" do
    every(30.minutes, "sync google docs") do
      GoogleDocs::IngestWorker.enqueue_with_tracking
    end
  end

  category "Google Ads" do
    every(1.day, "ingest geo target constants", at: "03:00") do
      GoogleAds::LocationTargeting::IngestWorker.perform_async
    end

    every(30.seconds, "poll active invites") do
      GoogleAds::PollActiveInvitesWorker.perform_async
    end
  end
end
