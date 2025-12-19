module Core
  class TestSites
    NON_TEXT_FORMATS = ["lockb", "ico", "png", "jpg", "jpeg", "gif", "svg", "webp"]
    IGNORED_DIRS = ["node_modules", ".git", "dist", "build"]

    class << self
      def list
        Dir.glob(Rails.root.join("test-sites", "*")).select { |f| File.directory?(f) }.map { |f| File.basename(f) }
      end

      def files_for(site_name)
        site_dir = Rails.root.join("test-sites", site_name)
        raise "Site not found: #{site_name}" unless File.directory?(site_dir)

        all_files = Dir.glob(Pathname.new(site_dir).join("**", "*"))

        all_files.filter_map do |file|
          next if File.directory?(file)
          next if NON_TEXT_FORMATS.include?(File.extname(file).delete("."))
          next if IGNORED_DIRS.any? { |dir| file.include?("/#{dir}/") }

          relative_path = file.sub(site_dir.to_s, "").sub(%r{^/}, "")
          content = File.read(file)

          {path: relative_path, content: content}
        end
      end

      def import_to_website(website, site_name)
        files = files_for(site_name)

        website.website_files.destroy_all

        files.each do |file_data|
          website.website_files.create!(
            path: file_data[:path],
            content: file_data[:content]
          )
        end

        website
      end
    end
  end
end
