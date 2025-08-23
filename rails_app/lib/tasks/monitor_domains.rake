task monitor_domains: :environment do
  Domain.send(:monitor_domains_sync)
end