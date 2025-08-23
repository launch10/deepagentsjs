# frozen_string_literal: true
class Cloudflare
  module Analytics
    module Queries
      class MonitorZones < Cloudflare::Analytics::Core::GraphqlService
        def get_all_zones(&block)
          query = <<~GRAPHQL
            query getAllZones {
              viewer {
                zones {
                zoneTag
              }
            }
          }
          GRAPHQL

          parser = lambda do |response|
            if response.success?
              response.parsed_body.dig(:data, :viewer, :zones).map { |zone| zone[:zoneTag] }.with_indifferent_access
            else
              response
            end
          end
          
          if block_given?
            paginated_execute(query) do |response|
              yield parser.call(response)
            end
          else
            parser.call(execute(query))
          end
        end

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
          
          results = execute(query, variables)
          results.parsed_body.dig(:data, :viewer, :zones, 0, :httpRequestsAdaptiveGroups).reduce({}) do |acc, group|
            acc[group[:dimensions][:host]] = group[:requests]
            acc
          end
        end
      end
    end
  end
end