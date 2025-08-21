# == Schema Information
#
# Table name: websites
#
#  id         :integer          not null, primary key
#  name       :string
#  project_id :integer
#  user_id    :integer
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  thread_id  :string
#
# Indexes
#
#  index_websites_on_created_at  (created_at)
#  index_websites_on_name        (name)
#  index_websites_on_project_id  (project_id)
#  index_websites_on_thread_id   (thread_id) UNIQUE
#  index_websites_on_user_id     (user_id)
#

require "rails_helper"
describe Website do
  let(:website) { FactoryBot.create(:website) }

  it "is valid" do
    expect(website).to be_valid
  end
end
