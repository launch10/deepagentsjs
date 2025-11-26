module CampaignConcerns
  module Scheduling
    extend ActiveSupport::Concern

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

    # Custom setter for ad_schedules to work with strong parameters
    def ad_schedules=(schedule_data)
      update_ad_schedules(schedule_data) if schedule_data.present?
    end
  end
end
