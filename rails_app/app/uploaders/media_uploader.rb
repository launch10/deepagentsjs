class MediaUploader < CarrierWave::Uploader::Base
  include CarrierWave::MiniMagick

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

  version :thumb, if: :image? do
    process resize_to_fill: [200, 200]
  end

  version :medium, if: :image? do
    process resize_to_fill: [800, 600]
  end

  version :favicon, if: :logo? do
    process resize_to_fill: [32, 32]
    process convert: "ico"

    def full_filename(for_file)
      "favicon.ico"
    end
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

  def image?(new_file)
    new_file.content_type&.start_with?("image/")
  end

  def logo?(new_file)
    image?(new_file) && model.is_logo?
  end
end
