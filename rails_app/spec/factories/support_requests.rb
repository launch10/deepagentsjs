# == Schema Information
#
# Table name: support_requests
#
#  id                 :bigint           not null, primary key
#  browser_info       :text
#  category           :string           not null
#  credits_remaining  :integer
#  description        :text             not null
#  notion_created     :boolean          default(FALSE)
#  slack_notified     :boolean          default(FALSE)
#  subject            :string           not null
#  submitted_from_url :string
#  subscription_tier  :string
#  supportable_type   :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint           not null
#  supportable_id     :bigint
#  ticket_id          :string           not null
#  user_id            :bigint           not null
#
# Indexes
#
#  index_support_requests_on_account_id   (account_id)
#  index_support_requests_on_supportable  (supportable_type,supportable_id)
#  index_support_requests_on_ticket_id    (ticket_id) UNIQUE
#  index_support_requests_on_user_id      (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (user_id => users.id)
#
FactoryBot.define do
  factory :support_request do
    association :user
    association :account
    category { "Report a bug" }
    subject { "Something is broken" }
    description { "When I click the button, nothing happens. I expected the page to load." }
    subscription_tier { "Growth" }
    credits_remaining { 100 }
    submitted_from_url { "http://localhost:3000/dashboard" }
    browser_info { "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }
  end
end
