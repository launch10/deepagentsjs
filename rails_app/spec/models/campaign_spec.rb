# == Schema Information
#
# Table name: campaigns
#
#  id                 :bigint           not null, primary key
#  daily_budget_cents :integer
#  launched_at        :datetime
#  name               :string
#  stage              :string           default("content")
#  status             :string           default("draft")
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint
#  project_id         :bigint
#  website_id         :bigint
#
# Indexes
#
#  index_campaigns_on_account_id             (account_id)
#  index_campaigns_on_account_id_and_stage   (account_id,stage)
#  index_campaigns_on_account_id_and_status  (account_id,status)
#  index_campaigns_on_created_at             (created_at)
#  index_campaigns_on_launched_at            (launched_at)
#  index_campaigns_on_project_id             (project_id)
#  index_campaigns_on_project_id_and_stage   (project_id,stage)
#  index_campaigns_on_project_id_and_status  (project_id,status)
#  index_campaigns_on_stage                  (stage)
#  index_campaigns_on_status                 (status)
#  index_campaigns_on_website_id             (website_id)
#
require 'rails_helper'

RSpec.describe Campaign, type: :model do
  describe "validations" do
    it { should validate_presence_of(:status) }
    it { should validate_inclusion_of(:status).in_array(Campaign::STATUSES) }
    it { should validate_presence_of(:stage) }
    it { should validate_inclusion_of(:stage).in_array(Campaign::STAGES) }
  end

  describe "nested attributes" do
    it { should accept_nested_attributes_for(:ad_groups).allow_destroy(true) }
    it { should accept_nested_attributes_for(:callouts).allow_destroy(true) }
    it { should accept_nested_attributes_for(:structured_snippets).allow_destroy(true) }
  end

  describe "Creation", :focus do
    it "creates ad, ad group, and campaign together" do
    end
  end
end
