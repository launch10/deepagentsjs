# frozen_string_literal: true

class Cloudflare
  module Analytics
    module Core
      class GraphqlService < ApplicationClient
        class GraphQLError < Error; end
        
        def initialize(auth: nil, basic_auth: nil, token: nil)
          token ||= Cloudflare.config.api_token
        super(auth: auth, basic_auth: basic_auth, token: token)
        end
        
        # Override base_uri to use configured value
        def base_uri
          Cloudflare.config.analytics_endpoint
        end
        
        def authorization_header
          { 
            "Authorization" => "Bearer #{token}" ,
            "X-Auth-Email" => "brett@easyml.app"
          }
        end
        
        def content_type
          "application/json"
        end
        
        def open_timeout
          Cloudflare.config.timeout
        end
        
        def read_timeout
          Cloudflare.config.timeout
        end
        
        # Execute a GraphQL query
        # @param query [String] The GraphQL query string
        # @param variables [Hash] Variables to pass to the query
        # @return [Response] The parsed response
        def execute(query, variables = {})
          post("", body: {
            query: query,
            variables: variables
          })
        end
        
        # Execute a GraphQL query with automatic pagination
        # @param query [String] The GraphQL query string  
        # @param variables [Hash] Variables to pass to the query
        # @yield [data] Each page of results
        def paginated_execute(query, variables = {}, &block)
          cursor = nil
          
          loop do
            paginated_variables = variables.merge(after: cursor).compact
            response = execute(query, paginated_variables)
            
            yield response if block_given?
            
            # Check for pagination info (adjust based on Cloudflare's GraphQL schema)
            page_info = response.dig(:viewer, :zones, 0, :pageInfo) || 
                      response.dig(:data, :viewer, :zones, 0, :pageInfo)
            
            break unless page_info&.fetch(:hasNextPage, false)
            cursor = page_info[:endCursor]
          end
        end
        
        protected
        
        def handle_response(response)
          # First check if it's a successful response
          case response.code
          when "200", "201", "202", "203", "204"
            # Check for GraphQL-specific errors in the response body
            # Response is an ApplicationClient::Response that delegates missing methods to parsed_body
            if response.respond_to?(:errors) && response.errors.present?
              error_messages = response.errors.map { |e| e.respond_to?(:message) ? e.message : e["message"] }.join(", ")
              raise GraphQLError, "GraphQL Error: #{error_messages}"
            end
            response
          else
            # Let parent handle non-200 responses
            super
          end
        end
        
        # Helper method to build common query fragments
        def build_filter(options = {})
          filter = {}
          
          filter[:zoneTag] = options[:zone_id] if options[:zone_id]
          filter[:datetime_geq] = options[:start_time].iso8601 if options[:start_time]
          filter[:datetime_lt] = options[:end_time].iso8601 if options[:end_time]
          
          filter
        end
      end
    end
  end
end