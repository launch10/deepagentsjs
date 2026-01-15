module Madmin
  class AccountsController < Madmin::ResourceController
    def index
      @accounts = ::Account.includes(:owner).order(created_at: :desc).limit(100)

      render inertia: "Madmin/Accounts/Index",
        props: {
          accounts: @accounts.map { |a| serialize_account(a) }
        }
    end

    def show
      @account = ::Account.find(params[:id])

      render inertia: "Madmin/Accounts/Show",
        props: {
          account: serialize_account(@account, detailed: true)
        }
    end

    private

    def serialize_account(account, detailed: false)
      data = {
        id: account.id,
        name: account.name,
        personal: account.personal?,
        ownerName: account.owner&.name,
        ownerEmail: account.owner&.email,
        usersCount: account.account_users_count,
        createdAt: account.created_at&.iso8601
      }

      if detailed
        data.merge!(
          domain: account.domain,
          subdomain: account.subdomain,
          billingEmail: account.billing_email,
          extraBillingInfo: account.extra_billing_info,
          timeZone: account.time_zone,
          planName: account.plan&.name,
          updatedAt: account.updated_at&.iso8601
        )
      end

      data
    end
  end
end
