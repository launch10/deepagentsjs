module GoogleAds
  module Resources
    # Concern that wraps Google Ads API operations with instrumentation context.
    # Include this in any resource class that makes API calls to automatically
    # tag logs with relevant domain model context.
    #
    # The including class must implement:
    # - #instrumentation_context - returns a hash of context for tagging (e.g., { campaign: @record })
    #
    # Usage: Call `instrument_methods` in your class to wrap public methods:
    #
    # @example
    #   class Campaign
    #     include Instrumentable
    #
    #     def instrumentation_context
    #       { campaign: record }
    #     end
    #
    #     # Define all methods first, then call instrument_methods at the bottom
    #     instrument_methods :sync, :synced?, :sync_result, :sync_plan, :fetch, :delete
    #   end
    #
    module Instrumentable
      extend ActiveSupport::Concern

      # Wraps a block with instrumentation context.
      # All Google Ads API calls within the block will have tagged logs.
      #
      # @yield The block to execute with instrumentation
      # @return The result of the block
      #
      def with_instrumentation(&block)
        GoogleAds::Instrumentation.with_context(**instrumentation_context, &block)
      end

      # Override this method in including classes to provide context
      # @return [Hash] Context hash for GoogleAds::Instrumentation.with_context
      def instrumentation_context
        {}
      end

      class_methods do
        # Wraps class-level operations that iterate over collections.
        # Delegates instrumentation to the instance level.
        #
        # @param context [Hash] Context to pass to Instrumentation.with_context
        # @yield The block to execute
        # @return The result of the block
        #
        def with_instrumentation(**context, &block)
          GoogleAds::Instrumentation.with_context(**context, &block)
        end

        # Wraps specified methods with instrumentation context.
        # The wrapper ensures all API calls within these methods are tagged.
        #
        # @param method_names [Array<Symbol>] Methods to wrap
        #
        def instrument_methods(*method_names)
          wrapper_module = Module.new do
            method_names.each do |method_name|
              define_method(method_name) do |*args, **kwargs, &block|
                with_instrumentation { super(*args, **kwargs, &block) }
              end
            end
          end

          prepend wrapper_module
        end
      end
    end
  end
end
