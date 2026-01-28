module Madmin
  class UsersController < Madmin::ResourceController
    def index
      @users = ::User.order(created_at: :desc).limit(100)

      render inertia: "Madmin/Users/Index",
        props: {
          users: @users.map { |u| serialize_user(u) }
        }
    end

    def show
      @user = ::User.find(params[:id])

      render inertia: "Madmin/Users/Show",
        props: {
          user: serialize_user(@user, detailed: true),
          creditReasons: CreditGift::REASONS,
          usageAdjustmentReasons: CreditUsageAdjustment::REASONS
        }
    end

    private

    def serialize_user(user, detailed: false)
      data = {
        id: user.id,
        name: user.name,
        email: user.email,
        admin: user.admin?,
        confirmed: user.confirmed?,
        createdAt: user.created_at&.iso8601
      }

      if detailed
        account = user.owned_account
        data.merge!(
          firstName: user.first_name,
          lastName: user.last_name,
          timeZone: user.time_zone,
          preferredLanguage: user.preferred_language,
          confirmedAt: user.confirmed_at&.iso8601,
          acceptedTermsAt: user.accepted_terms_at&.iso8601,
          acceptedPrivacyAt: user.accepted_privacy_at&.iso8601,
          updatedAt: user.updated_at&.iso8601,
          totalCredits: account&.total_credits || 0,
          planCredits: account&.plan_credits || 0,
          packCredits: account&.pack_credits || 0
        )
      end

      data
    end
  end
end
