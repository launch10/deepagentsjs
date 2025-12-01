class BaseBuilder
  include FactoryBot::Syntax::Methods
  include PlanHelpers if defined?(PlanHelpers)
  include SubscriptionHelpers if defined?(SubscriptionHelpers)

  def base_snapshot
    nil
  end

  def output_name
    raise "output_name must be implemented by subclass"
  end

  def build
    raise "build must be implemented by subclass"
  end

  def load_sql(sql_path)
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
end
