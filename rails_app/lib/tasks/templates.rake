namespace :templates do
  desc "Sync template files from local directory to database"
  task :sync, [:template_name] => :environment do |_t, args|
    template_name = args[:template_name] || "default"
    TemplateSyncer.sync!(template_name)
  end

  desc "Sync only specific files from template (comma-separated paths)"
  task :sync_files, [:template_name, :paths] => :environment do |_t, args|
    template_name = args[:template_name] || "default"
    paths = args[:paths]&.split(",")&.map(&:strip)

    if paths.blank?
      puts "Usage: rake templates:sync_files[template_name,'path1,path2']"
      exit 1
    end

    TemplateSyncer.sync!(template_name, only: paths)
  end
end
