# == Schema Information
#
# Table name: ad_schedules
#
#  id                    :bigint           not null, primary key
#  always_on             :boolean          default(FALSE), not null
#  bid_modifier          :decimal(10, 2)
#  day_of_week           :string
#  end_hour              :integer
#  end_minute            :integer
#  start_hour            :integer
#  start_minute          :integer
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  campaign_id           :bigint           not null
#  platform_criterion_id :string
#
# Indexes
#
#  index_ad_schedules_on_campaign_id                  (campaign_id)
#  index_ad_schedules_on_campaign_id_and_day_of_week  (campaign_id,day_of_week)
#  index_ad_schedules_on_created_at                   (created_at)
#  index_ad_schedules_on_day_of_week                  (day_of_week)
#
class AdSchedule < ApplicationRecord
  belongs_to :campaign

  validate :only_one_schedule_if_always_on
  validate :no_time_fields_if_always_on
  validate :time_fields_required_unless_always_on

  scope :always_on, -> { where(always_on: true) }
  scope :scheduled, -> { where(always_on: false) }

  def on_now?(time = Time.current)
    return true if always_on?

    day = time.strftime('%A').downcase
    return false unless day_of_week.downcase == day

    time_in_minutes = time.hour * 60 + time.min
    start_time = start_hour * 60 + start_minute
    end_time = end_hour * 60 + end_minute

    time_in_minutes >= start_time && time_in_minutes < end_time
  end

  private

  def only_one_schedule_if_always_on
    return unless always_on?

    other_schedules = campaign.ad_schedules.where.not(id: id)
    if other_schedules.exists?
      errors.add(:always_on, "cannot be true when other schedules exist")
    end
  end

  def no_time_fields_if_always_on
    return unless always_on?

    if day_of_week.present? || start_hour.present? || start_minute.present? || 
       end_hour.present? || end_minute.present?
      errors.add(:always_on, "schedule should not have time fields when always_on is true")
    end
  end

  def time_fields_required_unless_always_on
    return if always_on?

    errors.add(:day_of_week, "can't be blank") if day_of_week.blank?
    errors.add(:start_hour, "can't be blank") if start_hour.blank?
    errors.add(:start_minute, "can't be blank") if start_minute.blank?
    errors.add(:end_hour, "can't be blank") if end_hour.blank?
    errors.add(:end_minute, "can't be blank") if end_minute.blank?
  end
end
