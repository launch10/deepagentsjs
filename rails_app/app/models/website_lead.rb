# == Schema Information
#
# Table name: website_leads
#
#  id            :bigint           not null, primary key
#  gclid         :string
#  utm_campaign  :string
#  utm_content   :string
#  utm_medium    :string
#  utm_source    :string
#  utm_term      :string
#  visitor_token :string
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  lead_id       :bigint           not null
#  visit_id      :bigint
#  website_id    :bigint           not null
#
# Indexes
#
#  index_website_leads_on_gclid                           (gclid)
#  index_website_leads_on_lead_id                         (lead_id)
#  index_website_leads_on_lead_id_and_website_id          (lead_id,website_id) UNIQUE
#  index_website_leads_on_visit_id                        (visit_id)
#  index_website_leads_on_visitor_token                   (visitor_token)
#  index_website_leads_on_website_id                      (website_id)
#  index_website_leads_on_website_id_and_created_at_desc  (website_id,created_at DESC)
#

class WebsiteLead < ApplicationRecord
  belongs_to :lead
  belongs_to :website
  belongs_to :visit, class_name: "Ahoy::Visit", optional: true

  validates :lead_id, uniqueness: { scope: :website_id }
end
