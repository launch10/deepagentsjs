class CreateBrainstorms < ActiveRecord::Migration[8.0]
  def change
    create_table :brainstorms do |t|
      t.string :idea
      t.string :audience
      t.string :solution
      t.string :social_proof
      t.bigint :website_id
      t.timestamp :completed_at

      t.timestamps

      t.index :website_id
      t.index :completed_at
      t.index :created_at
    end
  end
end
