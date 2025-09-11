class AddFileSpecificationIdToTemplateFiles < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :template_files, :file_specification_id, :integer
      add_index :template_files, :file_specification_id

      file_specifications = FileSpecification.all.index_by(&:canonical_path)
      TemplateFile.all.each do |template_file|
        if file_specifications[template_file.path]
          template_file.update(file_specification_id: file_specifications[template_file.path].id)
        end
      end
    end
  end
end
