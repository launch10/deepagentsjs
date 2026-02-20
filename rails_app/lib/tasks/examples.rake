namespace :examples do
  desc "Save a website's code_files to shared/websites/examples/ for use as a template reference"
  task save: :environment do
    examples_dir = Rails.root.join("../shared/websites/examples")

    website = ActsAsTenant.without_tenant do
      if ENV["ID"]
        Website.find(ENV["ID"])
      else
        Website.order(created_at: :desc).first!
      end
    end

    name = ENV["NAME"] || website.name.parameterize(separator: "_")
    export_path = examples_dir.join(name)

    if export_path.exist? && ENV["OVERWRITE"] != "true"
      abort "Directory already exists: #{export_path}\nUse OVERWRITE=true to replace."
    end

    FileUtils.rm_rf(export_path) if export_path.exist?

    files = ActsAsTenant.without_tenant { website.code_files.to_a }
    abort "No code_files found for website #{website.id}" if files.empty?

    written = 0
    files.each do |cf|
      next if cf.path.blank? || cf.content.nil?

      file_path = export_path.join(cf.path)
      FileUtils.mkdir_p(file_path.dirname)
      File.write(file_path, cf.content)
      written += 1
    end

    puts "Exported \"#{website.name}\" (#{written} files) → #{export_path}"
  end

  desc "List existing website examples in shared/websites/examples/"
  task list: :environment do
    examples_dir = Rails.root.join("../shared/websites/examples")

    unless examples_dir.exist?
      puts "No examples directory found at #{examples_dir}"
      next
    end

    dirs = examples_dir.children.select(&:directory?).map(&:basename).sort
    if dirs.empty?
      puts "No examples found."
    else
      puts "#{dirs.size} example(s):"
      dirs.each { |d| puts "  #{d}" }
    end
  end
end
