class SupportController < SubscribedController
  def show
    render inertia: "Support", props: {
      categories: SupportRequest::CATEGORIES
    }
  end

  def create
    support_request = current_account.support_requests.build(support_params)
    support_request.user = current_user
    support_request.subscription_tier = current_account.plan&.tier&.display_name
    support_request.credits_remaining = Millicredits.to_credits(current_account.total_millicredits)

    if support_request.save
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

end
