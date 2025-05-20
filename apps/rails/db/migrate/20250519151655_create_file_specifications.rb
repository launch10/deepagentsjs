class CreateFileSpecifications < ActiveRecord::Migration[8.0]
  def change
    create_table :file_specifications do |t|
      t.string :canonical_path
      t.string :description
      t.string :filetype
      t.string :subtype
      t.string :language
      t.timestamps

      t.index :filetype
      t.index :subtype
      t.index :canonical_path
    end
  end
end
