# frozen_string_literal: true

class WebsiteWithImportErrors < BaseBuilder
  def base_snapshot
    "website_step_finished"
  end

  def output_name
    "website_with_import_errors"
  end

  def build
    website = Account.first.projects.first.website

    # Add a broken import and USE it so Vite can't tree-shake it away
    prepend_to_file!(website,
      path: "src/pages/IndexPage.tsx",
      content: "import { NonExistentComponent } from \"../components/NonExistent.tsx\";\n\n")

    # Also add the component usage so it will actually be resolved
    insert_component_usage!(website,
      path: "src/pages/IndexPage.tsx",
      marker: "return (",
      component: "<NonExistentComponent />")

    Rails.logger.info "Applied import error modifications to website #{website.id}"
    website
  end

  private

  def prepend_to_file!(website, path:, content:)
    file = website.website_files.find_by(path: path)
    raise "File not found: #{path}" unless file

    file.update!(content: content + file.content)
  end

  def insert_component_usage!(website, path:, marker:, component:)
    file = website.website_files.find_by(path: path)
    raise "File not found: #{path}" unless file

    # Insert the component right after the marker (typically "return (")
    new_content = file.content.gsub(marker, "#{marker}\n      #{component}")
    file.update!(content: new_content)
  end
end
