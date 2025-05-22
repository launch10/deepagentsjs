non_text_formats = ["lockb", "ico", "png", "jpg", "jpeg", "gif", "svg", "webp"]

namespace :seeds do
  desc "Load template seeds"
  task template: :environment do
    template_dirs = Dir.glob(Rails.root.join("data", "templates", "*"))
    templates = []
    template_files = []
    template_dirs.map do |template_dir|
      templates.push(Template.find_or_initialize_by(name: File.basename(template_dir)))
      files = Dir.glob(Pathname.new(template_dir).join("**", "*"))
      files.each do |file|
        next if non_text_formats.include?(File.extname(file).gsub(".", "")) # Skip non-text files
        next if File.directory?(file) # Skip directories

        file_content = File.read(file)
        path = file.sub(template_dir, "")
        begin
          template_files.push(TemplateFile.find_or_initialize_by(template: templates.last, path: path, content: file_content))
        rescue => e
          puts "Error reading file: #{file}, #{e.message}"
        end
      end
    end

    # Destroy templates and their files that are no longer in the seed data
    prev_templates = Template.all
    deleted_templates = prev_templates.map(&:name) - template_dirs.map { |dir| File.basename(dir) }
    templates_to_destroy = prev_templates.select { |template| deleted_templates.include?(template.name) }
    template_files_to_destroy = TemplateFile.where(template_id: templates_to_destroy.map(&:id))
    template_files_to_destroy.destroy_all
    Template.where(name: templates_to_destroy.map(&:name)).destroy_all

    # Import templates and their files
    Template.import(templates, on_duplicate_key_update: { conflict_target: :name, columns: :all })
    TemplateFile.import(template_files, on_duplicate_key_update: { conflict_target: [:template_id, :path], columns: :all })
  end
end