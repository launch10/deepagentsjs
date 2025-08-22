class Cloudflare
  class R2
    attr_reader :client, :bucket_name

    def initialize(bucket_name: nil)
      @bucket_name = bucket_name || "#{Cloudflare.config.r2_bucket_prefix}-#{Rails.env}"
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
        @client.send(method_name, *args, **kwargs, &block)
      else
        super
      end
    end

    def respond_to_missing?(method_name, include_private = false)
      @client.respond_to?(method_name, include_private) || super
    end
  end
end