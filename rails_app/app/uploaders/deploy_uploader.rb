require 'aws-sdk-s3'
require 'fileutils'

class DeployUploader
  attr_reader :client, :bucket_name

  def initialize
    @bucket_name = ENV.fetch('R2_BUCKET_NAME', 'nichefinder-deploys')
    @client = Aws::S3::Client.new(
      endpoint: ENV.fetch('R2_ENDPOINT', 'https://your-account-id.r2.cloudflarestorage.com'),
      access_key_id: ENV.fetch('R2_ACCESS_KEY_ID'),
      secret_access_key: ENV.fetch('R2_SECRET_ACCESS_KEY'),
      region: ENV.fetch('R2_REGION', 'auto'),
      force_path_style: true
    )
  end

  def store!(local_path, remote_path)
    # Upload all files from local_path to remote_path in R2
    Dir.glob("#{local_path}/**/*").select { |f| File.file?(f) }.each do |file|
      relative_path = file.sub("#{local_path}/", '')
      object_key = "#{remote_path}/#{relative_path}"
      
      File.open(file, 'rb') do |file_content|
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
    project_id = timestamp_path.split('/').first
    live_path = "#{project_id}/live"
    
    # Delete existing live directory
    delete_prefix(live_path)
    
    # Copy timestamp directory to live
    copy_prefix(timestamp_path, live_path)
    
    Rails.logger.info "Successfully hotswapped live deploy for project #{project_id}"
  end
  
  def preserve_current_live(project_id, timestamp)
    live_path = "#{project_id}/live"
    versioned_path = "#{project_id}/#{timestamp}"
    
    # Check if live exists
    objects = client.list_objects_v2(bucket: bucket_name, prefix: live_path, max_keys: 1)
    return if objects.contents.empty?
    
    # Copy live to timestamped version if it doesn't already exist
    versioned_objects = client.list_objects_v2(bucket: bucket_name, prefix: versioned_path, max_keys: 1)
    if versioned_objects.contents.empty?
      copy_prefix(live_path, versioned_path)
      Rails.logger.info "Preserved current live version to #{versioned_path}"
    end
  end

  def delete_prefix(prefix)
    objects = client.list_objects_v2(bucket: bucket_name, prefix: prefix)
    
    return if objects.contents.empty?
    
    delete_objects = objects.contents.map { |obj| { key: obj.key } }
    
    client.delete_objects(
      bucket: bucket_name,
      delete: { objects: delete_objects }
    )
  end

  def copy_prefix(source_prefix, dest_prefix)
    objects = client.list_objects_v2(bucket: bucket_name, prefix: source_prefix)
    
    objects.contents.each do |object|
      source_key = object.key
      dest_key = source_key.sub(source_prefix, dest_prefix)
      
      client.copy_object(
        bucket: bucket_name,
        copy_source: "#{bucket_name}/#{source_key}",
        key: dest_key
      )
    end
  end

  private

  def content_type_for(file)
    case File.extname(file).downcase
    when '.html', '.htm' then 'text/html'
    when '.css' then 'text/css'
    when '.js' then 'application/javascript'
    when '.json' then 'application/json'
    when '.png' then 'image/png'
    when '.jpg', '.jpeg' then 'image/jpeg'
    when '.gif' then 'image/gif'
    when '.svg' then 'image/svg+xml'
    when '.ico' then 'image/x-icon'
    when '.woff' then 'font/woff'
    when '.woff2' then 'font/woff2'
    when '.ttf' then 'font/ttf'
    when '.eot' then 'application/vnd.ms-fontobject'
    else 'application/octet-stream'
    end
  end
end