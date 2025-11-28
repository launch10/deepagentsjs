class CoreData < BaseBuilder
  NON_TEXT_FORMATS = ["lockb", "ico", "png", "jpg", "jpeg", "gif", "svg", "webp"]

  def base_snapshot
    nil
  end

  def output_name
    "core_data"
  end

  def build
    seed_core_data
    seed_plans
    seed_templates
    seed_themes
  end

  private

  def seed_core_data
    sql_path = Rails.root.join("db/seeds/core_data.sql")
    if File.exist?(sql_path)
      puts "Loading core_data.sql..."
      load_sql_via_psql(sql_path)
      puts "Core data loaded."
    else
      puts "Warning: db/seeds/core_data.sql not found, skipping"
    end
  end

  def load_sql_via_psql(sql_path)
    config = ActiveRecord::Base.connection_db_config.configuration_hash
    env = {"PGPASSWORD" => config[:password].to_s}
    args = ["psql"]
    args += ["-U", config[:username]] if config[:username]
    args += ["-h", config[:host] || "localhost"]
    args += ["-p", config[:port].to_s] if config[:port]
    args += ["-d", config[:database]]
    args += ["-f", sql_path.to_s]
    system(env, args.join(" "))
  end

  def seed_plans
    puts "Seeding plans..."

    ActiveRecord::Base.connection_handler.clear_all_connections!
    ActiveRecord::Base.establish_connection

    plan_limits = {
      requests_per_month: {
        starter: 1_000_000,
        pro: 5_000_000,
        enterprise: 20_000_000
      }
    }

    plans = [
      {
        name: "starter",
        amount: 4900,
        interval: "month",
        stripe_id: Rails.application.credentials.dig(:stripe, :plans, :starter),
        currency: "usd"
      },
      {
        name: "pro",
        amount: 9900,
        interval: "month",
        stripe_id: Rails.application.credentials.dig(:stripe, :plans, :pro),
        currency: "usd"
      },
      {
        name: "enterprise",
        amount: 24900,
        interval: "month",
        stripe_id: Rails.application.credentials.dig(:stripe, :plans, :enterprise),
        currency: "usd"
      }
    ]

    Plan.import(plans, on_duplicate_key_update: {conflict_target: :name})

    limits_to_import = plan_limits.map do |limit_type, limits|
      limits.map do |plan_name, limit|
        {
          plan_id: Plan.find_by(name: plan_name).id,
          limit_type: limit_type,
          limit: limit
        }
      end
    end

    PlanLimit.import(limits_to_import.flatten, on_duplicate_key_update: {conflict_target: [:plan_id, :limit_type]})

    puts "Plans seeded: #{Plan.count} plans, #{PlanLimit.count} limits"
  end

  def seed_templates
    puts "Seeding templates..."

    template_dirs = Dir.glob(Rails.root.join("templates", "*"))
    templates = []
    template_files = []

    template_dirs.each do |template_dir|
      templates.push(Template.find_or_initialize_by(name: File.basename(template_dir)))
      files = Dir.glob(Pathname.new(template_dir).join("**", "*"))

      files.each do |file|
        next if NON_TEXT_FORMATS.include?(File.extname(file).gsub(".", ""))
        next if File.directory?(file)

        file_content = File.read(file)
        path = file.sub(template_dir, "")
        begin
          template_files.push(TemplateFile.find_or_initialize_by(template: templates.last, path: path, content: file_content))
        rescue => e
          puts "Error reading file: #{file}, #{e.message}"
        end
      end
    end

    prev_templates = Template.all
    deleted_templates = prev_templates.map(&:name) - template_dirs.map { |dir| File.basename(dir) }
    templates_to_destroy = prev_templates.select { |template| deleted_templates.include?(template.name) }
    template_files_to_destroy = TemplateFile.where(template_id: templates_to_destroy.map(&:id))
    template_files_to_destroy.destroy_all
    Template.where(name: templates_to_destroy.map(&:name)).destroy_all

    Template.import(templates, on_duplicate_key_update: {conflict_target: :name, columns: :all})
    TemplateFile.import(template_files, on_duplicate_key_update: {conflict_target: [:template_id, :path], columns: :all})

    templates.each do |template|
      current_files = Dir.glob(Rails.root.join("templates", template.name, "**", "*")).map { |file|
        file.sub(
          Regexp.new(Rails.root.join("templates", template.name).to_s), ""
        ).gsub(/^\//, "")
      }
      TemplateFile.where(template_id: template.id).where.not(path: current_files).destroy_all
    end

    puts "Templates seeded: #{Template.count} templates, #{TemplateFile.count} files"
  end

  def seed_themes
    puts "Seeding themes..."

    sql_path = Rails.root.join("db/seeds/themes.sql")
    if File.exist?(sql_path)
      load_sql_via_psql(sql_path)
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
