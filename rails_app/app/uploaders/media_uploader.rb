class MediaUploader < CarrierWave::Uploader::Base
  if Rails.env.test?
    storage :file
  else
    storage :aws
  end

  def store_dir
    "uploads"
  end

  def filename
    "#{secure_token}.#{file.extension}"
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