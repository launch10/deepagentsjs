class Cloudflare
  class Analytics
    class GraphqlService
      def make_request(method, path, params = {})
        url = "#{config.base_url}#{path}"
        body = method == :get ? nil : params.to_json
        headers = build_headers(body)
        
        options = {
          method: method,
          headers: headers,
          timeout: config.timeout,
          connecttimeout: config.timeout / 2
        }
        
        if method == :get && params.any?
          url += "?#{URI.encode_www_form(params)}"
        elsif body
          options[:body] = body
        end
        
        request = Typhoeus::Request.new(url, options)
        response = request.run
        
        handle_typhoeus_response(response)
      end
    end
  end
end

# Sample

# %Q(
# query getHourlyTrafficSummaryByHost($zoneTag: string!, $startTime: time!, $endTime: time!) {
#   viewer {
#     zones(filter: { zoneTag: $zoneTag }) {
#       httpRequestsAdaptiveGroups(
#         filter: { 
#           datetime_geq: $startTime, 
#           datetime_lt: $endTime 
#         },
#         limit: 10000,
#         orderBy: [datetimeHour_ASC]
#       ) {
#         requests: count        
#         dimensions {
#           hour: datetimeHour
#           host: clientRequestHTTPHost
#         }
#       }
#     }
#   }
# }
# )
