class AddOriginalFilenameToUploads < ActiveRecord::Migration[8.0]
  def change
    add_column :uploads, :original_filename, :string
    # add_index :uploads, :original_filename
  end
end
