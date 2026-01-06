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

    # Updates the campaign's ad schedules from structured data.
    #
    # @param schedule_data [Hash] the schedule configuration
    # @option schedule_data [Boolean] :always_on whether the campaign runs 24/7
    # @option schedule_data [Array<String>] :day_of_week days when ads run (e.g., ['Monday', 'Tuesday'])
    # @option schedule_data [String] :start_time time ads start (e.g., '9:00am')
    # @option schedule_data [String] :end_time time ads end (e.g., '5:00pm')
    # @option schedule_data [String] :time_zone IANA time zone (e.g., 'America/New_York')
    #
    # @example Always-on schedule
    #   campaign.update_ad_schedules(always_on: true)
    #
    # @example Specific days and times
    #   campaign.update_ad_schedules(
    #     always_on: false,
    #     day_of_week: ['Monday', 'Tuesday', 'Wednesday'],
    #     start_time: '9:00am',
    #     end_time: '5:00pm',
    #     time_zone: 'America/Chicago'
    #   )
    # Always-on (runs 24/7)
    # { always_on: true }
    #
    # Specific days and times
    # {
    #   always_on: false,
    #   day_of_week: ['Monday', 'Tuesday', 'Wednesday'],
    #   start_time: '9:00am',
    #   end_time: '5:00pm',
    #   time_zone: 'America/Chicago'  # optional
    # }
    def update_ad_schedules(schedule_data)
      schedule.update(schedule_data)
    end

    # Custom setter for ad_schedules to work with strong parameters
    def ad_schedules=(schedule_data)
      update_ad_schedules(schedule_data) if schedule_data.present?
    end
  end
end
