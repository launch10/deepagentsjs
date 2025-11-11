namespace :create do
  task :project do
    data = JSON.parse(File.read(Rails.root.join("data/graphStateSnapshot.json")))

    user = User.last
    project = user.projects.create(data.dig("app", "project"))
    project.project_plans.create(data.dig("app", "project_plan"))
    pages = data.dig("app", "pages").map do |page|
      project.pages.build(page.except("sections"))
    end

    Project.transaction do
      pages = Page.import(pages, on_duplicate_key_update: {conflict_target: [:project_id, :page_type], columns: :all})
      pages_by_page_type = pages.group_by(&:page_type)
      sections = data.dig("app", "pages").flat_map do |page|
        page["sections"].map do |section|
          page_model = pages_by_page_type[page["page_type"]].find { |p| p.id == page["id"] }
          page_model.sections.build(section.merge(page_id: page_model.id))
        end
      end
      Section.import(sections, on_duplicate_key_update: {conflict_target: [:page_id, :section_type], columns: :all})
    end
  end
end
