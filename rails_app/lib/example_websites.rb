class ExampleWebsites
  EXAMPLES_PATH = File.expand_path("../../shared/websites/examples", __dir__)

  class << self
    def all
      return [] unless Dir.exist?(EXAMPLES_PATH)

      Dir.children(EXAMPLES_PATH)
        .select { |name| File.directory?(File.join(EXAMPLES_PATH, name)) }
        .map { |name| new(name) }
    end

    def find(name)
      template = new(name)
      template.exists? ? template : nil
    end

    def find!(name)
      find(name) || raise(ArgumentError, "Template '#{name}' not found")
    end
  end

  attr_reader :name

  def initialize(name)
    @name = name
  end

  def path
    File.join(EXAMPLES_PATH, name)
  end

  def exists?
    Dir.exist?(path)
  end

  def files
    return [] unless exists?

    Dir.glob("**/*", base: path)
      .reject { |f| File.directory?(File.join(path, f)) }
      .map { |relative_path| ExampleFile.new(self, relative_path) }
  end

  def file(relative_path)
    ExampleFile.new(self, relative_path)
  end

  class ExampleFile
    attr_reader :template, :relative_path

    def initialize(template, relative_path)
      @template = template
      @relative_path = relative_path
    end

    def path
      File.join(template.path, relative_path)
    end

    def exists?
      File.exist?(path)
    end

    def content
      return nil unless exists?
      File.read(path, encoding: 'UTF-8')
    end

    BINARY_EXTENSIONS = %w[.lockb .png .jpg .jpeg .gif .ico .woff .woff2 .ttf .eot .pdf .zip .tar .gz].freeze

    def binary?
      return true if BINARY_EXTENSIONS.include?(File.extname(relative_path).downcase)
      return false unless exists?
      content = File.read(path, 512)
      return true if content.nil?
      !content.force_encoding('UTF-8').valid_encoding?
    rescue ArgumentError
      true
    end

    def text?
      !binary?
    end
  end
end
