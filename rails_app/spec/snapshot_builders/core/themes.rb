module Core
  class Themes < BaseBuilder
    def seed
      puts "Seeding themes..."

      sql_path = Rails.root.join("db/seeds/themes.sql")
      if File.exist?(sql_path)
        load_sql(sql_path)
      end

      puts "Themes seeded: #{Theme.count} themes"
    end
  end
end
