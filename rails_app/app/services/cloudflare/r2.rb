class Cloudflare
  class R2
    attr_reader :client, :bucket_name, :environment

    def initialize(bucket_name: nil, environment: nil)
      @bucket_name = bucket_name || Cloudflare.config.r3_bucket
      @environment = environment || Cloudflare.config.deploy_env
      @client = Aws::S3::Client.new(
        endpoint: Cloudflare.config.r2_endpoint,
        access_key_id: Cloudflare.config.r2_access_key_id,
        secret_access_key: Cloudflare.config.r2_secret_access_key,
        region: Cloudflare.config.r2_region,
        force_path_style: false
      )
    end

    def method_missing(method_name, *args, **kwargs, &block)
      if @client.respond_to?(method_name)
        prefixed_kwargs = add_env_prefix_to_args(kwargs)
        
        @client.send(method_name, *args, **prefixed_kwargs, &block)
      else
        super
      end
    end

    def respond_to_missing?(method_name, include_private = false)
      @client.respond_to?(method_name, include_private) || super
    end

    private

    def prefixed_path(path)
      str_path = path.to_s
      return str_path if str_path.empty? || @environment.to_s.empty?

      env_prefix = "#{@environment}/"
      # Idempotency check... if we've retrieved a LIST of objects, they will be fully qualified already with
      # the environment prefix. We don't want to double-prefix them.
      return str_path if str_path.start_with?(env_prefix)

      File.join(@environment.to_s, str_path)
    end

    def add_env_prefix_to_args(kwargs)
      modified_kwargs = kwargs.dup

      modified_kwargs[:key] = prefixed_path(modified_kwargs[:key]) if modified_kwargs.key?(:key)
      modified_kwargs[:prefix] = prefixed_path(modified_kwargs[:prefix]) if modified_kwargs.key?(:prefix)

      if modified_kwargs.key?(:copy_source)
        source_string = modified_kwargs[:copy_source]
        source_bucket, source_key = source_string.split('/', 2)
        if source_key
          modified_kwargs[:copy_source] = "#{source_bucket}/#{prefixed_path(source_key)}"
        end
      end
      
      if modified_kwargs.key?(:delete) && modified_kwargs[:delete].is_a?(Hash)
        objects = modified_kwargs.dig(:delete, :objects)
        if objects.is_a?(Array)
          modified_kwargs[:delete][:objects] = objects.map do |obj|
            obj.merge(key: prefixed_path(obj[:key]))
          end
        end
      end

      modified_kwargs
    end
  end
end