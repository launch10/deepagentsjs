# Snapshot for the analytics dashboard with full metrics data.
# Creates multiple projects with different statuses, 30 days of analytics,
# ad performance data, and AI-generated insights.
#
# Based on the Figma design showing:
# - 4 projects: Premium Pet Portraits (Live), Family Portraits (Paused),
#   Example of a very long name... (Live), Test Draft (Draft)
# - Performance Overview charts with 30-day time series
# - Key Insights cards with actionable recommendations
#
class CampaignWithMetrics < BaseBuilder
  def base_snapshot
    "website_deployed"
  end

  def output_name
    "campaign_with_metrics"
  end

  def build
    account = Account.first
    raise "Account not found" unless account

    primary_project = account.projects.first
    raise "No project found" unless primary_project

    # Rename the existing project to match Figma
    primary_project.update!(name: "Premium Pet Portraits")

    # Create additional projects with different statuses
    projects = [
      { project: primary_project, status: "active", name: "Premium Pet Portraits" },
      create_project_with_website(account, "Family Portraits", campaign_status: "paused", with_deploy: true),
      create_project_with_website(account, "Example of a very long name for a site that is just way too long", campaign_status: "active", with_deploy: true),
      create_project_with_website(account, "Test Draft", campaign_status: nil, with_deploy: false)
    ]

    # Update the primary project's campaign status
    if primary_project.campaigns.any?
      primary_project.campaigns.update_all(status: "active", launched_at: 30.days.ago)
    else
      create_campaign_for_project(primary_project, status: "active")
    end

    # Generate 30 days of metrics for live/paused projects
    projects.each do |proj_data|
      project = proj_data[:project]
      next if proj_data[:status].nil? # Skip draft projects

      generate_daily_metrics(account, project, proj_data[:status])
      generate_ad_performance(project) if project.campaigns.any?
    end

    # Create dashboard insights matching Figma design
    create_dashboard_insights(account, projects)

    puts "Created campaign_with_metrics snapshot"
    puts "  - #{projects.count} projects"
    puts "  - 30 days of metrics per active project"
    puts "  - Dashboard insights generated"
  end

  private

  def create_project_with_website(account, name, campaign_status:, with_deploy:)
    project = account.projects.create!(name: name)

    # Create workflow
    project.workflows.create!(workflow_type: "launch", step: with_deploy ? "ads" : "website", substep: 0)

    # Create website
    Website.create!(
      account: account,
      project: project,
      name: name,
      theme: Theme.first || create(:theme),
      template: Template.first || create(:template)
    )

    # Create deploy if needed (skip domain creation due to plan limits)
    if with_deploy
      project.deploys.create!(
        status: "completed",
        is_live: true
      )
    end

    # Create campaign if needed
    if campaign_status
      create_campaign_for_project(project, status: campaign_status)
    end

    { project: project, status: campaign_status, name: name }
  end

  def create_campaign_for_project(project, status:)
    # Use Campaign.create_campaign! for proper setup, then update status
    result = Campaign.create_campaign!(project.account, {
      name: "#{project.name} Campaign",
      project_id: project.id,
      website_id: project.website.id
    })

    campaign = result[:campaign]
    campaign.update_columns(
      status: status,
      launched_at: (status == "active") ? 30.days.ago : nil
    )

    # Create budget if not already created
    campaign.create_budget!(daily_budget_cents: rand(1000..5000)) unless campaign.budget

    campaign
  end

  def generate_daily_metrics(account, project, status)
    base_date = Date.current
    metrics = []

    # Generate trends based on status
    # Active projects show growth, paused show flat/decline
    trend_multiplier = (status == "active") ? 1.05 : 0.98

    30.times do |day_offset|
      date = base_date - (29 - day_offset).days
      # 0.03 to 1.0

      # Base values that trend over time
      base_leads = (status == "active") ? rand(8..15) : rand(0..3)
      base_visitors = rand(80..150)
      base_page_views = rand(400..800)
      base_impressions = rand(800..1500)
      base_clicks = rand(30..70)
      base_cost = rand(15_000_000..35_000_000) # $15-$35 in micros

      # Apply trend multiplier compounding
      multiplier = trend_multiplier**day_offset

      metrics << AnalyticsDailyMetric.new(
        account: account,
        project: project,
        date: date,
        leads_count: (base_leads * multiplier).round,
        unique_visitors_count: (base_visitors * multiplier * rand(0.9..1.1)).round,
        page_views_count: (base_page_views * multiplier * rand(0.9..1.1)).round,
        impressions: (base_impressions * multiplier * rand(0.9..1.1)).round,
        clicks: (base_clicks * multiplier * rand(0.9..1.1)).round,
        cost_micros: (base_cost * multiplier * rand(0.9..1.1)).round
      )
    end

    AnalyticsDailyMetric.import(metrics)
  end

  def generate_ad_performance(project)
    base_date = Date.current
    campaign = project.campaigns.first
    return unless campaign

    performance_records = []

    30.times do |day_offset|
      date = base_date - (29 - day_offset).days

      performance_records << AdPerformanceDaily.new(
        campaign: campaign,
        date: date,
        impressions: rand(800..1500),
        clicks: rand(30..70),
        cost_micros: rand(15_000_000..35_000_000),
        conversions: rand(2..8).to_f,
        conversion_value_micros: rand(200_000_000..800_000_000)
      )
    end

    AdPerformanceDaily.import(performance_records)
  end

  def create_dashboard_insights(account, projects)
    # Find the first live project for the "stalled" insight
    live_project = projects.find { |p| p[:status] == "active" }

    insights = [
      {
        title: "Lead Generation Stalled",
        description: "#{live_project&.dig(:name) || "Your project"} hasn't generated leads in 7 days. Review your keywords or ad copy.",
        sentiment: "negative",
        project_uuid: live_project&.dig(:project)&.uuid,
        action: { label: "Review", url: "/projects/#{live_project&.dig(:project)&.uuid}" }
      },
      {
        title: "Click-Through Rate Improved",
        description: "Your campaigns are seeing higher engagement with an average CTR of 4.2%, up 23% across all active projects.",
        sentiment: "positive",
        project_uuid: nil,
        action: { label: "Review", url: "/dashboard" }
      },
      {
        title: "Cost-per-Lead Decreasing",
        description: "Averaging $28 per lead, down 18% from last week. Your targeting optimizations are working.",
        sentiment: "positive",
        project_uuid: nil,
        action: { label: "Review", url: "/dashboard" }
      }
    ]

    DashboardInsight.create!(
      account: account,
      insights: insights,
      metrics_summary: {
        total_leads_30d: 156,
        total_spend_30d: 614.0,
        avg_cpl_30d: 28.0,
        avg_ctr_30d: 0.042
      },
      generated_at: Time.current
    )
  end
end
