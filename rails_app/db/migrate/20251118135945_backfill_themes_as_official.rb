class BackfillThemesAsOfficial < ActiveRecord::Migration[8.0]
  def up
    Theme.where(theme_type: nil).update_all(theme_type: "official")
  end

  def down
    Theme.where(theme_type: "official").update_all(theme_type: nil)
  end
end
