module CampaignConcerns
  module Scheduling
    extend ActiveSupport::Concern

    included do
      has_many :ad_schedules, dependent: :destroy
    end

    def schedule
      @schedule ||= Schedule.new(self)
    end

    def on_now?(time = Time.current)
      schedule.on_now?(time)
    end

    def always_on?
      schedule.always_on?
    end

    def schedule_for(day)
      schedule.for(day)
    end

    def scheduled_hours_per_week
      schedule.hours_per_week
    end

    def ad_schedule_json
      schedule.as_json
    end

    def update_ad_schedules(schedule_data)
      schedule.update(schedule_data)
    end
  end
end
