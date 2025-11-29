require_relative "core/plans"
require_relative "core/templates"
require_relative "core/themes"

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
      load_sql(sql_path)
      puts "Core data loaded."
    else
      puts "Warning: db/seeds/core_data.sql not found, skipping"
    end
  end

  def seed_plans
    Core::Plans.new.seed
  end

  def seed_templates
    Core::Templates.new.seed
  end

  def seed_themes
    Core::Themes.new.seed
  end
end
