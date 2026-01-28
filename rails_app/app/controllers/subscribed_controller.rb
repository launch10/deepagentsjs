class SubscribedController < ApplicationController
  include Webcontainer
  before_action :refresh_jwt, if: proc { !request.format.json? && jwt_expired? }
  before_action :sign_in_jwt, if: proc { !user_signed_in? && jwt_user.present? }
  before_action :require_subscription!, unless: -> { Plan.none? }

  def root_path
    request.base_url
  end

  def langgraph_path
    Langgraph.url
  end

  inertia_share do
    flash_messages = []

    # Support both simple string flashes and structured {title:, description:} JSON strings
    [:notice, :error, :info].each do |flash_type|
      next unless flash[flash_type]

      type_map = {notice: "success", error: "error", info: "info"}
      parsed = parse_flash_message(flash[flash_type])

      if parsed.is_a?(Hash) && parsed["title"]
        flash_messages << {type: type_map[flash_type], title: parsed["title"], description: parsed["description"]}
      else
        flash_messages << {type: type_map[flash_type], message: flash[flash_type]}
      end
    end

    {
      root_path: root_path,
      langgraph_path: langgraph_path,
      jwt: cookies[:jwt],
      errors: session.delete(:errors) || {},
      flash: flash_messages,
      current_user: current_user_props,
      true_user: true_user&.slice(:id, :name, :email),
      impersonating: current_user && true_user && current_user.id != true_user.id,
      credits: credits_data
    }
  end

  private

  def credits_data
    return nil unless current_account

    {
      plan_credits: Millicredits.to_credits(current_account.plan_millicredits),
      pack_credits: Millicredits.to_credits(current_account.pack_millicredits),
      total_credits: Millicredits.to_credits(current_account.total_millicredits),
      plan_credits_allocated: current_account.full_plan_credits,
      period_ends_at: current_account.subscriptions.active.order(id: :desc).first&.current_period_end&.iso8601
    }
  end

  def sign_in_jwt
    sign_in(jwt_user, store: false)
  end

  def current_user_props
    return nil unless current_user
    current_user.slice(:id, :name, :email).merge(admin: current_user.admin?)
  end

  # Try to parse a flash message as JSON, returning the original string if it fails
  def parse_flash_message(message)
    return message unless message.is_a?(String) && message.start_with?("{")

    JSON.parse(message)
  rescue JSON::ParserError
    message
  end
end
