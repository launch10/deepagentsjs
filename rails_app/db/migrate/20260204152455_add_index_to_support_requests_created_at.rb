class AddIndexToSupportRequestsCreatedAt < ActiveRecord::Migration[8.0]
  def change
    # Composite index for rate limiting query: user.support_requests.where("created_at > ?", 1.hour.ago)
    add_index :support_requests, [:user_id, :created_at], name: "index_support_requests_on_user_id_and_created_at"
  end
end
