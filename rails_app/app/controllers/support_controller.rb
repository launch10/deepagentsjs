class SupportController < SubscribedController
  MAX_REQUESTS_PER_HOUR = 5

  def show
    support_chat = current_account.chats.find_by(chat_type: "support")

    render inertia: "Support", props: {
      thread_id: support_chat&.thread_id
    }
  end

  def create
    if rate_limited?
      redirect_to support_path, alert: "You've submitted too many requests recently. Please try again later."
      return
    end

    support_request = current_account.support_requests.build(support_params)
    support_request.user = current_user
    support_request.subscription_tier = current_account.plan&.tier&.display_name
    support_request.credits_remaining = Millicredits.to_credits(current_account.total_millicredits)

    if support_request.save
      SupportMailer.support_request(support_request).deliver_later
      Support::SlackNotificationWorker.perform_async(support_request.id)
      Support::NotionCreationWorker.perform_async(support_request.id)

      redirect_to support_path, notice: {
        title: "Request submitted",
        description: "Your ticket reference is #{support_request.ticket_reference}. We'll get back to you within 24 hours at #{current_user.email}."
      }.to_json
    else
      session[:errors] = support_request.errors.messages
      redirect_to support_path
    end
  end

  private

  def support_params
    params.require(:support_request).permit(
      :category, :subject, :description, :submitted_from_url, :browser_info, attachments: []
    )
  end

  def rate_limited?
    current_user.support_requests.where("created_at > ?", 1.hour.ago).count >= MAX_REQUESTS_PER_HOUR
  end
end
