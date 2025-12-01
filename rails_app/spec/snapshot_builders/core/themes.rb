module Core
  class Themes < BaseBuilder
    def seed
      puts "Seeding themes..."

      sql_path = Rails.root.join("db/seeds/themes.sql")
      if File.exist?(sql_path)
        load_sql(sql_path)
      end

      theme_classes_struct = Struct.new(
        :background_class,
        :foreground_class,
        :muted_class,
        :primary_class,
        :secondary_class,
        :accent_class
      )

      theme_variants = {
        white: {
          background_class: "--background",
          foreground_class: "--foreground",
          muted_class: "--foreground-muted",
          primary_class: "--primary",
          secondary_class: "--secondary",
          accent_class: "--accent"
        },
        primary: {
          background_class: "--primary",
          foreground_class: "--primary-foreground",
          muted_class: "--primary-foreground-muted",
          primary_class: "--background",
          secondary_class: "--secondary",
          accent_class: "--accent"
        },
        secondary: {
          background_class: "--secondary",
          foreground_class: "--secondary-foreground",
          muted_class: "--secondary-foreground-muted",
          primary_class: "--primary",
          secondary_class: "--background",
          accent_class: "--secondary-foreground"
        },
        neutral: {
          background_class: "--neutral",
          foreground_class: "--neutral-foreground",
          muted_class: "--neutral-foreground-muted",
          primary_class: "--primary",
          secondary_class: "--secondary",
          accent_class: "--neutral-foreground"
        },
        muted: {
          background_class: "--muted",
          foreground_class: "--muted-foreground",
          muted_class: "--muted-foreground-muted",
          primary_class: "--primary",
          secondary_class: "--secondary",
          accent_class: "--muted-foreground"
        },
        accent: {
          background_class: "--accent",
          foreground_class: "--accent-foreground",
          muted_class: "--accent-foreground-muted",
          primary_class: "--accent-foreground",
          secondary_class: "--accent-foreground-muted",
          accent_class: "--accent-foreground"
        }
      }

      theme_variants.each do |_, classes_hash|
        classes = theme_classes_struct.new(**classes_hash)
        tv = ThemeVariant.find_or_initialize_by(background_class: classes.background_class)
        tv.assign_attributes(classes.to_h)
        tv.save!
      end

      puts "Themes seeded: #{Theme.count} themes, #{ThemeVariant.count} variants"
    end
  end
end
