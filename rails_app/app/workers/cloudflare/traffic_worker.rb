class Cloudflare::TrafficWorker < ApplicationWorker
  include TrafficControl::Concurrency
  concurrency 3

  def perform(options = {})
    return unless Flipper[:bart_logging].enabled?

    options.symbolize_keys!

    company = Company.find(options[:company_id])
    BartService.predict_revenue(company)
    SalesforceSync.enqueue_borrower(company.primary_borrower)
  end

  class BatchWorker < ApplicationWorker
    def perform(batch_options = {})
      return unless Flipper[:bart_logging].enabled?

      already_generated = BartPrediction.where("created_at BETWEEN ? AND ?", EST.now - 20.days,
                                               EST.now).map(&:company_id)
      companies = Company.where("created_at BETWEEN ? AND ?", 2.days.ago,
                                EST.now).where.not(completed_questionnaire_at: nil).where.not(naics: nil).where.not(annual_revenue: nil)
      if already_generated.any?
        companies = companies.where.not(id: already_generated)
        1
      end
      companies.each do |company|
        BartWorker.perform_async(company_id: company.id)
      end
    end
  end
end


# Get batches of zones to process
%Q(
query getAllZones {
  viewer {
    zones {
      zoneTag
    }
  }
}
)

# Process each zone
%Q(
query getHourlyTrafficSummaryByHost($zoneTag: string!, $startTime: time!, $endTime: time!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        filter: { 
          datetime_geq: $startTime, 
          datetime_lt: $endTime 
        },
        limit: 10000,
        orderBy: [datetimeHour_ASC]
      ) {
        requests: count        
        dimensions {
          hour: datetimeHour
          host: clientRequestHTTPHost
        }
      }
    }
  }
}
)

# Upsert to domain_request_counts
# Check:
# 
%Q(
SELECT DATE_TRUNC('month', created_date) AS month, COUNT(*) AS count
FROM domain_request_counts
WHERE user_id = user_id
AND created_date BETWEEN ? AND ?
GROUP BY 1
)

# If greater than user limit, update user firewall
# Add user firewall rules
# 
# Stop checking users zones
#
# domain -> has cloudflare_zone_id
# potentially: Prioritize zones with the most requests

# Possibly:
# Use Postgres NOTIFY commands and setup rails channel

# db/migrate/YYYYMMDDHHMMSS_create_partitioned_domain_request_counts.rb
# class CreatePartitionedDomainRequestCounts < ActiveRecord::Migration[7.1]
#   def up
#     # 1. Create the "parent" partitioned table. It holds no data itself.
#     execute <<-SQL
#       CREATE TABLE domain_request_counts (
#           id BIGSERIAL,
#           user_id INT NOT NULL,
#           domain_name TEXT NOT NULL,
#           request_counts INT NOT NULL,
#           hour TIMESTAMPTZ NOT NULL,
#           PRIMARY KEY (id, hour) -- The partition key MUST be part of the primary key
#       ) PARTITION BY RANGE (hour);
#     SQL

#     # 2. Add an index that will be inherited by all child partitions.
#     # This is crucial for your analytical query performance.
#     execute <<-SQL
#       CREATE INDEX idx_drc_user_hour ON domain_request_counts (user_id, hour);
#     SQL

#     # 3. Pre-create partitions for the current month and a few future months.
#     # This ensures your app can write data immediately after deployment.
#     current_date = Date.today
#     (0..2).each do |i|
#       partition_date = current_date + i.months
#       partition_name = "domain_request_counts_#{partition_date.strftime('%Y_%m')}"
      
#       # e.g., FROM ('2024-12-01') TO ('2025-01-01')
#       start_of_month = partition_date.beginning_of_month.strftime('%Y-%m-%d')
#       start_of_next_month = (partition_date + 1.month).beginning_of_month.strftime('%Y-%m-%d')

#       puts "Creating partition #{partition_name}..."
#       execute <<-SQL
#         CREATE TABLE #{partition_name} PARTITION OF domain_request_counts
#             FOR VALUES FROM ('#{start_of_month}') TO ('#{start_of_next_month}');
#       SQL
#     end

#     # 4. (Optional but recommended) Add your real-time trigger to the parent table.
#     # It will be automatically inherited by all current and future partitions.
#     execute <<-SQL
#       CREATE TRIGGER enforce_rate_limit_trigger
#       AFTER INSERT ON domain_request_counts
#       FOR EACH ROW
#       EXECUTE FUNCTION check_user_rate_limit(); -- Assuming this function is already created
#     SQL
#   end

#   def down
#     # Dropping the parent table automatically drops all its partitions.
#     execute "DROP TABLE IF EXISTS domain_request_counts;"
#   end
# end

# app/services/postgres_listener.rb
# class PostgresListener
# def listen
# ActiveRecord::Base.connection_pool.with_connection do |connection|
# conn = connection.instance_variable_get(:@connection)

# begin
# conn.async_exec "LISTEN new_invoice_created"
# conn.async_exec "LISTEN another_channel"
# conn.async_exec "LISTEN other_table_update"

# loop do
# conn.wait_for_notify do |channel, pid, payload|
# if payload.present?
# record = JSON.parse(payload)
# case channel
# when 'new_invoice_created'
# handle_new_invoice(record)
# when 'another_channel'
# handle_another_channel(record)
# when 'other_table_update'
# handle_other_table_update(record)
# end
# end
# end
# end
# ensure
# conn.async_exec "UNLISTEN *"
# end
# end
# end

# private

# def new_invoice_created(record)
# NewInvoiceCreatedJob.perform_now(record)
# end

# def handle_another_channel(record)
# HandleOtherChannelJob.perform_now(record)
# end

# def handle_other_table_update(record)
# HandleOtherTableUpdateJob.perform_now(record)
# end
# end