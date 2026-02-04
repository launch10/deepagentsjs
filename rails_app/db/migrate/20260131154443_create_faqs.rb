# frozen_string_literal: true

class CreateFAQs < ActiveRecord::Migration[8.0]
  def change
    create_table :faqs do |t|
      t.string :question, null: false
      t.text :answer, null: false
      t.string :category, null: false
      t.string :subcategory
      t.string :slug, null: false
      t.integer :position, default: 0, null: false
      t.boolean :published, default: true, null: false

      t.timestamps
    end

    add_index :faqs, :slug, unique: true
    add_index :faqs, :category
    add_index :faqs, [:published, :position]
  end
end
