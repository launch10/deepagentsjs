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
end