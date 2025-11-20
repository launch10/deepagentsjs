class MediaUploader < CarrierWave::Uploader::Base
  storage :aws

  def store_dir
    "#{Rails.env}/#{model.class.to_s.underscore.pluralize}/#{model.uuid}"
  end

  def filename
    "#{secure_token}.#{file.extension}" if original_filename.present?
  end

  # image/jpeg, video/mp4, etc (mimetypes)
  def content_type_allowlist
    [/image\//, /video\//]
  end

  def size_range
    model.video? ? 1..500.megabytes : 1..100.megabytes
  end

  protected
  
  def secure_token
    var = :"@#{mounted_as}_secure_token"
    model.instance_variable_get(var) || model.instance_variable_set(var, SecureRandom.uuid)
  end
end