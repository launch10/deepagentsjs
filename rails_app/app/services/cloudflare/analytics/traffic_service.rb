# frozen_string_literal: true

class Cloudflare
  module Analytics
    class TrafficService < GraphqlService
      # Get hourly traffic summary grouped by host
      # @param zone_id [String] The Cloudflare zone ID
      # @param start_time [Time] Start of the time range
      # @param end_time [Time] End of the time range
      # @return [Response] Traffic data grouped by hour and host
      def hourly_traffic_by_host(zone_id:, start_time:, end_time:)
        query = <<~GRAPHQL
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
        GRAPHQL
        
        variables = {
          zoneTag: zone_id,
          startTime: start_time.iso8601,
          endTime: end_time.iso8601
        }
        
        execute(query, variables)
      end
      
      # Get daily traffic summary with key metrics
      # @param zone_id [String] The Cloudflare zone ID
      # @param start_date [Date] Start date
      # @param end_date [Date] End date
      # @return [Response] Daily traffic metrics
      def daily_traffic_summary(zone_id:, start_date:, end_date:)
        query = <<~GRAPHQL
          query getDailyTrafficSummary($zoneTag: string!, $startTime: time!, $endTime: time!) {
            viewer {
              zones(filter: { zoneTag: $zoneTag }) {
                httpRequests1dGroups(
                  filter: {
                    date_geq: $startTime,
                    date_lt: $endTime
                  },
                  orderBy: [date_ASC]
                ) {
                  dimensions {
                    date
                  }
                  sum {
                    requests
                    bytes
                    cachedBytes
                    threats
                  }
                  uniq {
                    uniques: clientIP
                  }
                }
              }
            }
          }
        GRAPHQL
        
        variables = {
          zoneTag: zone_id,
          startTime: start_date.to_time.iso8601,
          endTime: end_date.to_time.iso8601
        }
        
        execute(query, variables)
      end
      
      # Get top paths by request count
      # @param zone_id [String] The Cloudflare zone ID
      # @param start_time [Time] Start of the time range
      # @param end_time [Time] End of the time range
      # @param limit [Integer] Number of top paths to return
      # @return [Response] Top paths with request counts
      def top_paths(zone_id:, start_time:, end_time:, limit: 10)
        query = <<~GRAPHQL
          query getTopPaths($zoneTag: string!, $startTime: time!, $endTime: time!, $limit: Int!) {
            viewer {
              zones(filter: { zoneTag: $zoneTag }) {
                httpRequestsAdaptiveGroups(
                  filter: {
                    datetime_geq: $startTime,
                    datetime_lt: $endTime
                  },
                  limit: $limit,
                  orderBy: [count_DESC]
                ) {
                  count
                  dimensions {
                    path: clientRequestPath
                    method: clientRequestMethod
                  }
                }
              }
            }
          }
        GRAPHQL
        
        variables = {
          zoneTag: zone_id,
          startTime: start_time.iso8601,
          endTime: end_time.iso8601,
          limit: limit
        }
        
        execute(query, variables)
      end
      
      # Get bandwidth usage over time
      # @param zone_id [String] The Cloudflare zone ID
      # @param start_time [Time] Start of the time range
      # @param end_time [Time] End of the time range
      # @param interval [String] Time interval: "hour" or "day"
      # @return [Response] Bandwidth usage data
      def bandwidth_usage(zone_id:, start_time:, end_time:, interval: "hour")
        query = if interval == "day"
          daily_bandwidth_query
        else
          hourly_bandwidth_query
        end
        
        variables = {
          zoneTag: zone_id,
          startTime: start_time.iso8601,
          endTime: end_time.iso8601
        }
        
        execute(query, variables)
      end
      
      # Get error rates by status code
      # @param zone_id [String] The Cloudflare zone ID  
      # @param start_time [Time] Start of the time range
      # @param end_time [Time] End of the time range
      # @return [Response] Error counts grouped by status code
      def error_rates(zone_id:, start_time:, end_time:)
        query = <<~GRAPHQL
          query getErrorRates($zoneTag: string!, $startTime: time!, $endTime: time!) {
            viewer {
              zones(filter: { zoneTag: $zoneTag }) {
                httpRequestsAdaptiveGroups(
                  filter: {
                    datetime_geq: $startTime,
                    datetime_lt: $endTime,
                    edgeResponseStatus_geq: 400
                  },
                  limit: 100,
                  orderBy: [count_DESC]
                ) {
                  count
                  dimensions {
                    status: edgeResponseStatus
                    path: clientRequestPath
                  }
                }
              }
            }
          }
        GRAPHQL
        
        variables = {
          zoneTag: zone_id,
          startTime: start_time.iso8601,
          endTime: end_time.iso8601
        }
        
        execute(query, variables)
      end
      
      private
      
      def hourly_bandwidth_query
        <<~GRAPHQL
          query getHourlyBandwidth($zoneTag: string!, $startTime: time!, $endTime: time!) {
            viewer {
              zones(filter: { zoneTag: $zoneTag }) {
                httpRequestsAdaptiveGroups(
                  filter: {
                    datetime_geq: $startTime,
                    datetime_lt: $endTime
                  },
                  orderBy: [datetimeHour_ASC]
                ) {
                  dimensions {
                    hour: datetimeHour
                  }
                  sum {
                    bytes
                    cachedBytes
                  }
                }
              }
            }
          }
        GRAPHQL
      end
      
      def daily_bandwidth_query
        <<~GRAPHQL
          query getDailyBandwidth($zoneTag: string!, $startTime: time!, $endTime: time!) {
            viewer {
              zones(filter: { zoneTag: $zoneTag }) {
                httpRequests1dGroups(
                  filter: {
                    date_geq: $startTime,
                    date_lt: $endTime
                  },
                  orderBy: [date_ASC]
                ) {
                  dimensions {
                    date
                  }
                  sum {
                    bytes
                    cachedBytes
                  }
                }
              }
            }
          }
        GRAPHQL
      end
    end
  end
end

# Example usage:
#
# service = Cloudflare::Analytics::TrafficService.new
#
# # Get hourly traffic for the last 24 hours
# traffic = service.hourly_traffic_by_host(
#   zone_id: "your-zone-id",
#   start_time: 24.hours.ago,
#   end_time: Time.current
# )
#
# # Get daily summary for the last week
# summary = service.daily_traffic_summary(
#   zone_id: "your-zone-id",
#   start_date: 7.days.ago.to_date,
#   end_date: Date.current
# )
#
# # Get top 20 paths
# top_paths = service.top_paths(
#   zone_id: "your-zone-id",
#   start_time: 1.hour.ago,
#   end_time: Time.current,
#   limit: 20
# )
#
# # Get error rates
# errors = service.error_rates(
#   zone_id: "your-zone-id",
#   start_time: 1.day.ago,
#   end_time: Time.current
# )