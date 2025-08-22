class Cloudflare
  class R2
    attr_reader :client, :bucket_name

    def initialize
      @bucket_name = Cloudflare.r2_bucket_name
      @client = Aws::S3::Client.new(
        endpoint: Cloudflare.r2_endpoint,
        access_key_id: Cloudflare.r2_access_key_id,
        secret_access_key: Cloudflare.r2_secret_access_key,
        region: Cloudflare.r2_region,
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