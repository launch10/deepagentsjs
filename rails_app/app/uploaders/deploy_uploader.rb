require "aws-sdk-s3"
require "fileutils"
class DeployUploader
  attr_reader :client, :bucket_name, :environment

  def initialize(environment: Cloudflare.deploy_env)
    @environment = environment
    @bucket_name = Cloudflare.deploys_bucket
    @client = Cloudflare::R2.new(bucket_name: @bucket_name, environment: @environment)
  end

  def store!(local_path, remote_path)
    # Upload all files from local_path to remote_path in R2
    Dir.glob("#{local_path}/**/*").select { |f| File.file?(f) }.each do |file|
      relative_path = file.sub("#{local_path}/", "")
      object_key = "#{remote_path}/#{relative_path}"

      Rails.logger.info "Uploading to R2 - bucket: #{bucket_name}, key: #{object_key}"

      File.open(file, "rb") do |file_content|
        client.put_object(
          bucket: bucket_name,
          key: object_key,
          body: file_content,
          content_type: content_type_for(file)
        )
      end
    end

    Rails.logger.info "Successfully uploaded deploy to #{remote_path}"
  end

  def hotswap_live(timestamp_path)
    hotswap_to_target(timestamp_path, "live")
  end

  def hotswap_to_target(timestamp_path, target_dir)
    project_id = timestamp_path.split("/").first
    target_path = "#{project_id}/#{target_dir}"

    # Verify source exists before attempting operations
    source_objects = list_objects(timestamp_path, max_keys: 1)
    if source_objects.contents.empty?
      error_msg = "Source path #{timestamp_path} does not exist or is empty"
      Rails.logger.error error_msg
      raise StandardError, error_msg
    end

    Rails.logger.info "Starting hotswap: #{timestamp_path} -> #{target_path}"
    Rails.logger.info "Found #{list_objects(timestamp_path).contents.size} objects in source"

    # Delete existing target directory
    Rails.logger.info "Deleting existing #{target_dir} directory: #{target_path}"
    delete_prefix(target_path)

    # Copy timestamp directory to target
    Rails.logger.info "Copying #{timestamp_path} to #{target_path}"
    copied_count = copy_prefix(timestamp_path, target_path)

    if copied_count == 0
      error_msg = "No files were copied from #{timestamp_path} to #{target_path}"
      Rails.logger.error error_msg
      raise StandardError, error_msg
    end

    Rails.logger.info "Copied #{copied_count} files to #{target_dir} directory"

    # Validate that target directory now exists and has content
    Rails.logger.info "Validating #{target_dir} directory..."
    target_objects = list_objects(target_path)

    if target_objects.contents.empty?
      error_msg = "CRITICAL: #{target_dir} directory is empty after hotswap! Source: #{timestamp_path}, Destination: #{target_path}"
      Rails.logger.error error_msg

      # Log diagnostic information
      Rails.logger.error "Attempting to diagnose issue..."
      all_project_objects = list_objects(project_id)
      Rails.logger.error "All objects under project #{project_id}:"
      all_project_objects.contents.each do |obj|
        Rails.logger.error "  - #{obj.key} (size: #{obj.size} bytes)"
      end

      raise StandardError, error_msg
    end

    Rails.logger.info "Successfully hotswapped #{target_dir} deploy for project #{project_id}"
    Rails.logger.info "#{target_dir.capitalize} directory now contains #{target_objects.contents.size} objects"

    # Return true to indicate success
    true
  end

  def list_objects(prefix, **)
    client.list_objects_v2(bucket: bucket_name, prefix: prefix, **)
  end

  def cleanup_old_deploys(project_id, keep_timestamps = [])
    Rails.logger.info "Starting cleanup for project #{project_id}, keeping: #{keep_timestamps.inspect}"

    # List all objects under the project
    all_objects = list_objects(project_id)

    # Group objects by their timestamp directory
    timestamp_dirs = {}
    all_objects.contents.each do |obj|
      # Extract timestamp from path (e.g., "project_id/20240101120000/file.html")
      parts = obj.key.split("/")
      next if parts.length < 2
      next if parts[1] == "live" # Skip live directory

      timestamp = parts[1]
      next unless timestamp =~ /^\d{14}$/ # Skip non-timestamp directories

      timestamp_dirs[timestamp] ||= []
      timestamp_dirs[timestamp] << obj.key
    end

    # Delete timestamp directories that should not be kept
    deleted_count = 0
    timestamp_dirs.each do |timestamp, keys|
      if keep_timestamps.include?(timestamp)
        Rails.logger.info "Keeping timestamp directory: #{project_id}/#{timestamp} (#{keys.length} files)"
      else
        Rails.logger.info "Deleting timestamp directory: #{project_id}/#{timestamp} (#{keys.length} files)"

        # Delete all objects in this timestamp directory
        delete_objects = keys.map { |key| {key: key} }

        begin
          client.delete_objects(
            bucket: bucket_name,
            delete: {objects: delete_objects}
          )
          deleted_count += keys.length
        rescue => e
          Rails.logger.error "Failed to delete timestamp directory #{timestamp}: #{e.message}"
        end
      end
    end

    Rails.logger.info "Cleanup complete. Deleted #{deleted_count} files from old deploys"
    deleted_count
  end

  def preserve_current_live(project_id, timestamp)
    live_path = "#{project_id}/live"
    versioned_path = "#{project_id}/#{timestamp}"

    # Check if live exists
    objects = list_objects(live_path, max_keys: 1)
    return if objects.contents.empty?

    # Copy live to timestamped version if it doesn't already exist
    versioned_objects = list_objects(versioned_path, max_keys: 1)
    if versioned_objects.contents.empty?
      copy_prefix(live_path, versioned_path)
      Rails.logger.info "Preserved current live version to #{versioned_path}"
    end
  end

  def delete_prefix(prefix)
    begin
      objects = list_objects(prefix)
    rescue Aws::S3::Errors::NoSuchKey
      return # No objects to delete
    end

    return if objects.contents.empty?

    delete_objects = objects.contents.map { |obj| {key: obj.key} }

    client.delete_objects(
      bucket: bucket_name,
      delete: {objects: delete_objects}
    )
  end

  def copy_prefix(source_prefix, dest_prefix)
    begin
      Rails.logger.info "Starting copy operation: #{source_prefix} -> #{dest_prefix}"
      objects = list_objects(source_prefix)
    rescue Aws::S3::Errors::NoSuchKey => e
      Rails.logger.error "Source prefix not found: #{source_prefix}"
      raise e
    end

    if objects.contents.empty?
      Rails.logger.warn "No objects to copy from #{source_prefix}"
      return 0
    end

    copied_count = 0
    failed_keys = []

    objects.contents.each do |object|
      source_key = object.key
      dest_key = source_key.sub(source_prefix, dest_prefix)

      begin
        Rails.logger.debug "Copying: #{source_key} -> #{dest_key}"
        client.copy_object(
          bucket: bucket_name,
          copy_source: "#{bucket_name}/#{source_key}",
          key: dest_key
        )
        copied_count += 1
      rescue => e
        Rails.logger.error "Failed to copy #{source_key}: #{e.message}"
        failed_keys << source_key
      end
    end

    if failed_keys.any?
      error_msg = "Failed to copy #{failed_keys.size} objects: #{failed_keys.join(", ")}"
      Rails.logger.error error_msg
      raise StandardError, error_msg
    end

    Rails.logger.info "Successfully copied #{copied_count} objects from #{source_prefix} to #{dest_prefix}"
    copied_count
  end

  private

  def content_type_for(file)
    case File.extname(file).downcase
    when ".html", ".htm" then "text/html"
    when ".css" then "text/css"
    when ".js" then "application/javascript"
    when ".json" then "application/json"
    when ".png" then "image/png"
    when ".jpg", ".jpeg" then "image/jpeg"
    when ".gif" then "image/gif"
    when ".svg" then "image/svg+xml"
    when ".ico" then "image/x-icon"
    when ".woff" then "font/woff"
    when ".woff2" then "font/woff2"
    when ".ttf" then "font/ttf"
    when ".eot" then "application/vnd.ms-fontobject"
    else "application/octet-stream"
    end
  end
end
