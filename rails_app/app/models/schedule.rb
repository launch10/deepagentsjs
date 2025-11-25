class Schedule
  attr_reader :campaign

  def initialize(campaign)
    @campaign = campaign
  end

  def empty?
    campaign.ad_schedules.empty?
  end

  def blank?
    empty?
  end

  def present?
    !empty?
  end

  def always_on?
    campaign.ad_schedules.always_on.exists?
  end

  def scheduled?
    campaign.ad_schedules.scheduled.exists?
  end

  def on_now?(time = Time.current)
    return false if empty?
    campaign.ad_schedules.any? { |schedule| schedule.on_now?(time) }
  end

  def time_zone
    campaign.time_zone
  end

  def time_zone=(value)
    campaign.update_column(:time_zone, value)
  end

  def for(day)
    campaign.ad_schedules.where(day_of_week: day.to_s.capitalize)
  end

  def hours_per_week
    return 168 if always_on?

    campaign.ad_schedules.scheduled.sum do |schedule|
      start_minutes = schedule.start_hour * 60 + schedule.start_minute
      end_minutes = schedule.end_hour * 60 + schedule.end_minute
      (end_minutes - start_minutes) / 60.0
    end
  end

  def to_json(*_args)
    as_json
  end

  def as_json(_options = {})
    if always_on?
      {
        always_on: true,
        day_of_week: [],
        start_time: nil,
        end_time: nil,
        time_zone: time_zone
      }
    else
      grouped = campaign.ad_schedules.scheduled.group_by do |s|
        [s.start_hour, s.start_minute, s.end_hour, s.end_minute]
      end

      grouped.map do |time_range, schedules|
        start_hour, start_minute, end_hour, end_minute = time_range
        {
          always_on: false,
          day_of_week: schedules.map(&:day_of_week).sort,
          start_time: format_time(start_hour, start_minute),
          end_time: format_time(end_hour, end_minute),
          time_zone: time_zone
        }
      end.first || {
        always_on: false,
        day_of_week: [],
        start_time: nil,
        end_time: nil,
        time_zone: time_zone
      }
    end
  end

  # Updates the campaign schedule from structured data
  #
  # @param schedule_data [Hash] the schedule configuration
  # @option schedule_data [Boolean] :always_on whether the campaign runs 24/7
  # @option schedule_data [Array<String>] :day_of_week days when ads should run (e.g., ['Monday', 'Tuesday'])
  # @option schedule_data [String] :start_time time when ads start (e.g., '9:00am')
  # @option schedule_data [String] :end_time time when ads end (e.g., '5:00pm')
  # @option schedule_data [String] :time_zone IANA time zone (e.g., 'America/New_York')
  #
  # @example Always-on schedule
  #   schedule.update(always_on: true, time_zone: 'America/New_York')
  #
  # @example Specific days and times
  #   schedule.update(
  #     always_on: false,
  #     day_of_week: ['Monday', 'Tuesday'],
  #     start_time: '9:00am',
  #     end_time: '5:00pm',
  #     time_zone: 'America/Chicago'
  #   )
  #
  # @return [void]
  def update(schedule_data)
    Campaign.transaction do
      destroy

      if schedule_data[:time_zone].present?
        self.time_zone = schedule_data[:time_zone]
      end

      if schedule_data[:always_on]
        campaign.ad_schedules.create!(always_on: true)
      else
        days = schedule_data[:day_of_week] || []
        start_hour, start_minute = parse_time(schedule_data[:start_time])
        end_hour, end_minute = parse_time(schedule_data[:end_time])

        days.each do |day|
          campaign.ad_schedules.create!(
            day_of_week: day,
            start_hour: start_hour,
            start_minute: start_minute,
            end_hour: end_hour,
            end_minute: end_minute,
            always_on: false
          )
        end
      end
    end
  end

  def destroy
    campaign.ad_schedules.destroy_all
  end

  private

  def format_time(hour, minute)
    time = Time.new(2000, 1, 1, hour, minute)
    time.strftime("%-l:%M%P")
  end

  def parse_time(time_string)
    return [0, 0] if time_string.blank?

    time = Time.parse(time_string)
    [time.hour, time.min]
  end
end
