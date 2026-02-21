require_relative "core/plan_tiers"
require_relative "core/tier_limits"
require_relative "core/plans"
require_relative "core/credit_packs"
require_relative "core/templates"
require_relative "core/themes"
require_relative "core/faqs"
require_relative "core/model_configs"
require_relative "core/model_preferences"
require_relative "core/friends_family_plan"

class CoreData < BaseBuilder
  def base_snapshot
    nil
  end

  def output_name
    "core_data"
  end

  def build
    seed_core_data
    seed_plans
    seed_credit_packs
    seed_templates
    seed_themes
    seed_faqs
    seed_model_configs
    seed_model_preferences
    seed_friends_family_plan
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

  def seed_credit_packs
    Core::CreditPacks.new.seed
  end

  def seed_templates
    Core::Templates.new.seed
  end

  def seed_themes
    Core::Themes.new.seed
  end

  def seed_faqs
    Core::FAQs.new.seed
  end

  def seed_model_configs
    Core::ModelConfigs.new.seed
  end

  def seed_model_preferences
    Core::ModelPreferences.new.seed
  end

  def seed_friends_family_plan
    Core::FriendsFamilyPlan.new.seed
  end
end
