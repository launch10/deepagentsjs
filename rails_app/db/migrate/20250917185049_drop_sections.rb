class DropSections < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      drop_table :sections
    end
  end

  def down
    create_table :sections do |t|
      t.string :noop
    end
  end
end
