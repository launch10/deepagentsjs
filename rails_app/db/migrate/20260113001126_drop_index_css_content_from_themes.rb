class DropIndexCssContentFromThemes < ActiveRecord::Migration[8.0]
  def change
    safety_assured { remove_column :themes, :index_css_content, :text }
  end
end
