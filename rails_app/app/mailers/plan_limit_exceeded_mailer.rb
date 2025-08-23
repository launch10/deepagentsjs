class PlanLimitExceededMailer < ApplicationMailer
  def notify_user(user, current_usage, limit)
    @user = user
    @current_usage = current_usage
    @limit = limit
    @percentage_used = ((current_usage.to_f / limit) * 100).round(2)
    @overage = current_usage - limit
    
    mail(
      to: @user.email,
      subject: "Plan limit exceeded - Your domains have been temporarily blocked"
    )
  end
end