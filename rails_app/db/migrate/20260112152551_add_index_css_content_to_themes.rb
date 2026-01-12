class AddIndexCssContentToThemes < ActiveRecord::Migration[8.0]
  def change
    add_column :themes, :index_css_content, :text
  end
end
