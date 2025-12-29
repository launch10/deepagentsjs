class CreateSocialLinks < ActiveRecord::Migration[8.0]
  def change
    create_table :social_links do |t|
      t.references :project, null: false, foreign_key: true
      t.string :platform, null: false
      t.string :url
      t.string :handle

      t.timestamps
    end

    add_index :social_links, [:project_id, :platform], unique: true
  end
end
