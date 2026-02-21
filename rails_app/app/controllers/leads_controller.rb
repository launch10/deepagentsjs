class LeadsController < SubscribedController
  before_action :set_project

  def index
    @pagy, @leads = pagy(@project.leads_with_conversion_date, limit: 20)

    render inertia: "Leads", props: {
      project: @project.to_mini_json,
      leads: @leads.map { |l|
        {
          id: l.id,
          name: l.name,
          email: l.email,
          phone: l.phone,
          date: l.conversion_date.strftime("%b %-d, %Y")
        }
      },
      pagination: pagy_metadata(@pagy)
    }
  end

  def export
    leads = @project.leads_with_conversion_date

    csv_data = CSV.generate(headers: true) do |csv|
      csv << ["Name", "Email", "Phone", "Date"]
      leads.each do |lead|
        csv << [lead.name || "", lead.email, lead.phone || "", lead.conversion_date.strftime("%b %-d, %Y")]
      end
    end

    send_data csv_data,
      filename: "#{@project.name.parameterize}-leads-#{Date.current.iso8601}.csv",
      type: "text/csv"
  end

  private

  def set_project
    @project = current_account.projects.find_by(uuid: params[:project_uuid])
    render json: { error: "Project not found" }, status: :not_found unless @project
  end

  def pagy_metadata(pagy)
    {
      current_page: pagy.page,
      total_pages: pagy.pages,
      total_count: pagy.count,
      prev_page: pagy.prev,
      next_page: pagy.next,
      from: pagy.from,
      to: pagy.to,
      series: pagy.series
    }
  end
end
