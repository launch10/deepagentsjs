# frozen_string_literal: true

module Testing
  # In-memory mock for Aws::S3::Client used in E2E tests.
  #
  # When Cloudflare.e2e_mock_s3_client is set, Cloudflare::R2 uses this
  # instead of the real S3 client. All operations succeed and files are
  # tracked in memory so subsequent list/copy operations work correctly.
  #
  # Usage:
  #   Cloudflare.e2e_mock_s3_client = Testing::E2eS3Client.new
  #   # ... deploy runs, all R2 operations are no-ops ...
  #   Cloudflare.e2e_mock_s3_client = nil  # reset
  #
  class E2eS3Client
    attr_reader :stored_objects

    def initialize
      @stored_objects = {}  # key => { body_size:, content_type: }
    end

    def put_object(bucket:, key:, body: nil, content_type: nil, **_opts)
      size = body.respond_to?(:size) ? body.size : 0
      @stored_objects[key] = { body_size: size, content_type: content_type }
      OpenStruct.new(etag: "\"mock-etag-#{Digest::MD5.hexdigest(key)}\"")
    end

    def list_objects_v2(bucket:, prefix: "", max_keys: 1000, **_opts)
      matching = @stored_objects.select { |k, _| k.start_with?(prefix.to_s) }
      contents = matching.first(max_keys).map do |key, meta|
        OpenStruct.new(key: key, size: meta[:body_size] || 100, last_modified: Time.current)
      end
      OpenStruct.new(contents: contents, is_truncated: false)
    end

    def copy_object(bucket:, copy_source:, key:, **_opts)
      # Extract source key from "bucket/key" format
      _source_bucket, source_key = copy_source.split("/", 2)
      @stored_objects[key] = if @stored_objects.key?(source_key)
        @stored_objects[source_key].dup
      else
        # Just track it anyway
        { body_size: 100, content_type: "application/octet-stream" }
      end
      OpenStruct.new(copy_object_result: OpenStruct.new(etag: "\"mock-copy-etag\""))
    end

    def delete_objects(bucket:, delete:, **_opts)
      objects = delete[:objects] || []
      deleted = objects.map do |obj|
        @stored_objects.delete(obj[:key])
        OpenStruct.new(key: obj[:key])
      end
      OpenStruct.new(deleted: deleted, errors: [])
    end

    def delete_object(bucket:, key:, **_opts)
      @stored_objects.delete(key)
      OpenStruct.new
    end

    def head_object(bucket:, key:, **_opts)
      if @stored_objects.key?(key)
        meta = @stored_objects[key]
        OpenStruct.new(content_length: meta[:body_size] || 100, content_type: meta[:content_type])
      else
        raise Aws::S3::Errors::NotFound.new(nil, "Not Found")
      end
    end

    def get_object(bucket:, key:, **_opts)
      if @stored_objects.key?(key)
        OpenStruct.new(body: StringIO.new("mock-content"), content_type: @stored_objects[key][:content_type])
      else
        raise Aws::S3::Errors::NoSuchKey.new(nil, "No Such Key")
      end
    end

    # Catch-all for S3 methods we haven't explicitly mocked.
    # Only respond to methods that look like S3 operations (verb_noun pattern).
    S3_METHOD_PATTERN = /\A(get|put|delete|list|head|copy|create|abort|complete|upload)_/

    def respond_to_missing?(method_name, include_private = false)
      S3_METHOD_PATTERN.match?(method_name) || super
    end

    def method_missing(method_name, **_kwargs)
      if S3_METHOD_PATTERN.match?(method_name)
        Rails.logger.info "[E2eS3Client] Unhandled S3 method: #{method_name}"
        OpenStruct.new
      else
        super
      end
    end
  end
end
