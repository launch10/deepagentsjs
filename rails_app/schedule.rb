require_relative "config/environment"

Zhong.redis = Redis.new(url: ENV["REDIS_URL"])

def est_time(time)
  ActiveSupport::TimeZone.new("America/New_York").parse(time).utc.strftime("%H:%M")
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

  category "Domains" do
    # Verify DNS for custom domains that haven't been verified yet
    # Runs hourly to catch DNS changes without overloading the system
    # Scoped to domains created within 7 days that haven't been checked in the last hour
    every(1.hour, "verify custom domain dns") do
      Domains::DnsVerificationBatchWorker.perform_async
    end

    # Release custom domains that have failed DNS verification for 7+ days
    # Prevents domain squatting and frees up domains for legitimate owners
    every(1.day, "release stale unverified domains", at: "04:00") do
      Domains::ReleaseStaleDomainsWorker.perform_async
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

  category "Credits" do
    every(1.day, "daily credit reconciliation", at: est_time("12:01")) do
      Credits::DailyReconciliationWorker.perform_async
    end

    every(1.minute, "find unprocessed llm usage") do
      Credits::FindUnprocessedRunsWorker.perform_async
    end
  end

  category "Analytics" do
    # Sync Google Ads performance data hourly for near-real-time dashboard
    # Uses 7-day rolling window to capture late-arriving conversions
    # Note: Google Ads API has ~2-4 hour reporting lag
    every(1.hour, "sync google ads performance") do
      GoogleAds::SyncPerformanceWorker.perform_async
    end

    # Compute daily analytics metrics from source tables
    # Runs daily to aggregate historical data; today's data uses live queries
    every(1.day, "compute daily metrics", at: "05:00") do
      Analytics::ComputeDailyMetricsWorker.perform_async
    end
  end
end
