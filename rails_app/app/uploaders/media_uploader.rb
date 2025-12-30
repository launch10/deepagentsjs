class MediaUploader < CarrierWave::Uploader::Base
  include CarrierWave::MiniMagick

  # SVG sanitization - strips malicious content before storing
  # Using process instead of callback to ensure file content is modified
  process :sanitize_svg_file

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

  # image/jpeg, video/mp4, application/pdf, etc (mimetypes)
  def content_type_allowlist
    [/image\//, /video\//, "application/pdf"]
  end

  def size_range
    if model.video?
      1..500.megabytes
    elsif model.document?
      1..50.megabytes
    else
      1..100.megabytes
    end
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

  private

  # Sanitize SVG files to remove potential XSS vectors
  # This removes <script> tags, event handlers (onclick, onload, etc.),
  # and javascript: URLs that could execute malicious code.
  # Called via process directive during file caching.
  def sanitize_svg_file
    return unless svg_file?

    content = File.read(current_path)
    sanitized = SvgSanitizer.sanitize(content)
    File.write(current_path, sanitized)
  end

  def svg_file?
    return false unless current_path

    # Check both content type and file extension for SVG detection
    content_type = file&.content_type
    extension = File.extname(current_path).downcase

    content_type == "image/svg+xml" || extension == ".svg"
  end
end
