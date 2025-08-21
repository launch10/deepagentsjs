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
require 'support/website_file_helpers'
describe Website do
  let(:website) { FactoryBot.create(:website) }

  it "is valid" do
    expect(website).to be_valid
  end

  it "snapshots website files" do
    file = website.files.create!(path: "index.html", content: "Hello World")
    expect(website.files.count).to eq(1)
    expect(website.files.first.content).to eq("Hello World")

    website.snapshot
    expect(website.files.count).to eq(1)
    expect(website.files.first.content).to eq("Hello World")

    original_snapshot = website.files.first
    file.update!(content: "Goodnight Moon")

    website.snapshot
    expect(website.files.first.content).to eq("Goodnight Moon")
    expect(original_snapshot.content).to eq("Hello World")

    current_snapshot = website.files.last
    expect(current_snapshot.content).to eq("Goodnight Moon")
    expect(original_snapshot.content).to eq("Hello World")
  end
end
