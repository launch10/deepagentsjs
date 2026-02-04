class FixSupportRequestsColumns < ActiveRecord::Migration[8.0]
  def change
    safety_assured { remove_column :support_requests, :email_sent, :boolean, default: false }
    safety_assured { change_column :support_requests, :browser_info, :text }
  end
end
