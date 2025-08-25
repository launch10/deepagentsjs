module FileConcerns
  module Setters
    extend ActiveSupport::Concern

    def path=(path)
      path.gsub(/^\//, "").tap do |p|
        write_attribute(:path, p)
      end
    end

    def basename
      path.split("/").last
    end

    def filename
      basename
    end
  end
end
