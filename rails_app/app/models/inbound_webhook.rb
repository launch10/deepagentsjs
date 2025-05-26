# == Schema Information
#
# Table name: inbound_webhooks
#
#  id         :integer          not null, primary key
#  status     :integer          default("0"), not null
#  body       :text
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class InboundWebhook < ApplicationRecord
  cattr_accessor :incinerate_after, default: 7.days
  enum :status, %i[pending processing processed failed]

  after_update_commit :incinerate_later, if: -> { status_previously_changed? && processed? }

  def incinerate_later
    InboundWebhooks::IncinerationJob.set(wait: incinerate_after).perform_later(self)
  end
end
