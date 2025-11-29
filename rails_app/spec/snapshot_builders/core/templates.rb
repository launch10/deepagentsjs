module Core
  class Templates < BaseBuilder
    NON_TEXT_FORMATS = ["lockb", "ico", "png", "jpg", "jpeg", "gif", "svg", "webp"]

    def seed
      puts "Seeding templates..."

      template_dirs = Dir.glob(Rails.root.join("templates", "*"))
      templates = []
      template_files = []

      template_dirs.each do |template_dir|
        templates.push(Template.find_or_initialize_by(name: File.basename(template_dir)))
        files = Dir.glob(Pathname.new(template_dir).join("**", "*"))

        files.each do |file|
          next if NON_TEXT_FORMATS.include?(File.extname(file).gsub(".", ""))
          next if File.directory?(file)

          file_content = File.read(file)
          path = file.sub(template_dir, "")
          begin
            template_files.push(TemplateFile.find_or_initialize_by(template: templates.last, path: path, content: file_content))
          rescue => e
            puts "Error reading file: #{file}, #{e.message}"
          end
        end
      end

      prev_templates = Template.all
      deleted_templates = prev_templates.map(&:name) - template_dirs.map { |dir| File.basename(dir) }
      templates_to_destroy = prev_templates.select { |template| deleted_templates.include?(template.name) }
      template_files_to_destroy = TemplateFile.where(template_id: templates_to_destroy.map(&:id))
      template_files_to_destroy.destroy_all
      Template.where(name: templates_to_destroy.map(&:name)).destroy_all

      Template.import(templates, on_duplicate_key_update: {conflict_target: :name, columns: :all})
      TemplateFile.import(template_files, on_duplicate_key_update: {conflict_target: [:template_id, :path], columns: :all})

      templates.each do |template|
        current_files = Dir.glob(Rails.root.join("templates", template.name, "**", "*")).map { |file|
          file.sub(
            Regexp.new(Rails.root.join("templates", template.name).to_s), ""
          ).gsub(/^\//, "")
        }
        TemplateFile.where(template_id: template.id).where.not(path: current_files).destroy_all
      end

      embed_missing

      puts "Templates seeded: #{Template.count} templates, #{TemplateFile.count} files"
    end

    def embed_missing
      puts "Embedding missing template files..."
      TemplateFile.where(embedding: nil).find_each do |file|
        AI::GenerateEmbeddingWorker.perform_async("TemplateFile", file.id)
      end
    end
  end
end