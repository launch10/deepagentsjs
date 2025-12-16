module Core
  class GeoTargetConstants < BaseBuilder
    def base_snapshot
      nil
    end

    def output_name
      "geo_target_constants"
    end

    def build
      seed
    end

    def seed
      puts "Seeding GeoTargetConstants..."
      sql_path = Rails.root.join("db/seeds/geo_target_constants.sql")

      if File.exist?(sql_path)
        load_sql(sql_path)
        puts "GeoTargetConstants seeded successfully (#{GeoTargetConstant.count} records)"
      else
        puts "Warning: db/seeds/geo_target_constants.sql not found, skipping"
      end
    end
  end
end
