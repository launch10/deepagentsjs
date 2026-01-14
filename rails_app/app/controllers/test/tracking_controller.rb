class Test::TrackingController < Test::TestController
  # GET /test/tracking/stats?website_id=X
  def stats
    website = Website.find(params[:website_id])
    visits = website.visits
    events = Ahoy::Event.where(visit_id: visits.pluck(:id))

    render json: {
      visit_count: visits.count,
      visitor_tokens: visits.pluck(:visitor_token).uniq,
      events: events.map { |e| { name: e.name, properties: e.properties, time: e.time } }
    }
  end

  # GET /test/tracking/leads?website_id=X
  # Returns leads and conversion events for a website
  def leads
    website = Website.find(params[:website_id])
    website_leads = website.website_leads.includes(:lead, :visit)

    # Get conversion events for this website's visits
    visit_ids = website.visits.pluck(:id)
    conversion_events = Ahoy::Event
      .where(visit_id: visit_ids, name: "conversion")
      .order(time: :desc)

    render json: {
      lead_count: website_leads.count,
      leads: website_leads.map do |wl|
        {
          email: wl.lead.email,
          name: wl.lead.name,
          gclid: wl.gclid,
          visitor_token: wl.visitor_token,
          visit_token: wl.visit&.visit_token,
          created_at: wl.created_at.iso8601
        }
      end,
      conversions: conversion_events.map do |e|
        {
          value: e.properties["value"],
          currency: e.properties["currency"],
          email: e.properties["email"],
          time: e.time&.iso8601
        }
      end
    }
  end

  # GET /test/tracking/info
  # Returns info about the built tracking test project/website
  # Creates the test records if they don't exist (e.g., after database restore)
  def info
    require Rails.root.join("spec/support/analytics/tracking_test_builder")

    website = TrackingTestBuilder.test_website

    # If website doesn't exist (e.g., after database snapshot restore), create test records
    website ||= TrackingTestBuilder.send(:create_test_records!)

    render json: {
      projectId: website.project_id,
      websiteId: website.id
    }
  end

  # GET /test/tracking/built
  # GET /test/tracking/built/*path
  # Serves the pre-built tracking-test website (real tracking.ts + real Vite build)
  def built
    require Rails.root.join("spec/support/analytics/tracking_test_builder")

    unless TrackingTestBuilder.build_exists?
      return render plain: "Tracking test build not found. Run: rake test:tracking:build", status: :not_found
    end

    # Redirect to trailing slash to ensure relative paths resolve correctly
    # Without this, ./assets/foo.js at /test/tracking/built resolves to /test/tracking/assets/foo.js
    if params[:path].blank? && !request.original_fullpath.end_with?("/")
      return redirect_to "#{request.original_fullpath}/"
    end

    # Default to index.html for root path
    file_path = params[:path].presence || "index.html"
    full_path = File.join(TrackingTestBuilder.dist_path, file_path)

    unless File.exist?(full_path) && full_path.start_with?(TrackingTestBuilder.dist_path)
      return render plain: "File not found: #{file_path}", status: :not_found
    end

    # Determine content type
    content_type = case File.extname(full_path)
    when ".html" then "text/html"
    when ".js" then "application/javascript"
    when ".css" then "text/css"
    when ".json" then "application/json"
    when ".svg" then "image/svg+xml"
    when ".png" then "image/png"
    when ".jpg", ".jpeg" then "image/jpeg"
    when ".ico" then "image/x-icon"
    else "application/octet-stream"
    end

    send_file full_path, type: content_type, disposition: "inline"
  end
end
