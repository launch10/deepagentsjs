class LocationTargeting
  attr_reader :campaign

  def initialize(campaign)
    @campaign = campaign
  end

  # Google Ads requires at least one positive (non-excluded) location target
  def valid?
    !empty? && has_positive_target?
  end

  def invalid?
    !valid?
  end

  def empty?
    campaign.location_targets.empty?
  end

  def blank?
    empty?
  end

  def present?
    !empty?
  end

  def errors
    @errors ||= []
  end

  def validate!
    @errors = []

    if empty?
      @errors << "At least one location target is required"
    elsif !has_positive_target?
      @errors << "At least one positive (non-excluded) location target is required"
    end

    raise ActiveRecord::RecordInvalid.new(campaign) if @errors.any?
  end

  private

  def has_positive_target?
    campaign.location_targets.targeted.exists?
  end
end
