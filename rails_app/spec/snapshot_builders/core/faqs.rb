module Core
  class FAQs < BaseBuilder
    def seed
      puts "Seeding FAQs..."
      # Optionally, you could actually pull the latest from Google Docs
      # and sync it to the database using GoogleDocs::SyncService.perform

      sql_path = Rails.root.join("db/seeds/faqs.sql")
      unless File.exist?(sql_path)
        raise "FAQs seed file not found: #{sql_path}"
      end
      load_sql(sql_path)

      puts "FAQs seeded successfully"
    end
  end
end
