# frozen_string_literal: true

module Atlas
  class DeploymentService < BaseService
    DEPLOY_PATH = '/api/internal/deploy'

    def deploy(site_id:, files: nil, config: nil)
      params = { siteId: site_id }
      params[:files] = files if files
      params[:config] = config if config

      with_logging(:post, DEPLOY_PATH, params) do
        make_request(:post, DEPLOY_PATH, params)
      end
    end

    # Helper method to prepare files for deployment
    def prepare_files(project)
      files = {}
      
      project.project_files.each do |file|
        files[file.path] = {
          content: file.content,
          type: file.content_type || 'text/plain'
        }
      end

      files
    end

    # Deploy a project with its files
    def deploy_project(project, site_id: nil)
      site_id ||= project.site_id
      
      raise ArgumentError, "Site ID is required" unless site_id

      files = prepare_files(project)
      config = build_deployment_config(project)

      deploy(
        site_id: site_id,
        files: files,
        config: config
      )
    end

    private

    def build_deployment_config(project)
      {
        projectId: project.id,
        projectName: project.name,
        deployedAt: Time.current.iso8601,
        version: project.version || '1.0.0',
        metadata: project.metadata || {}
      }
    end
  end
end