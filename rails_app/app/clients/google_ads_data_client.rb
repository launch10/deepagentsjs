class GoogleAdsDataClient < ApplicationClient
  BASE_URI = "https://developers.google.com/static/google-ads/api/data/geo".freeze

  Response::PARSER["application/zip"] = ->(response) { response.body }

  def authorization_header = {}

  def content_type = "application/zip"

  def ssl_verify_mode
    Rails.env.local? ? OpenSSL::SSL::VERIFY_NONE : OpenSSL::SSL::VERIFY_PEER
  end

  def geo_targets_zip(date:)
    get("/geotargets-#{date.strftime('%Y-%m-%d')}.csv.zip")
  rescue NotFound
    nil
  end

  def find_latest_geo_targets_zip(lookback_days: 90)
    lookback_days.times do |days_ago|
      date = Date.current - days_ago
      response = geo_targets_zip(date: date)
      return response.body if response
    end

    nil
  end
end
