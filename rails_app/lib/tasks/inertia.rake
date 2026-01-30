# frozen_string_literal: true

namespace :inertia do
  UUID_PARAM = {
    name: "uuid",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "Project UUID"
  }.freeze

  desc "Generate OpenAPI YAML from Inertia prop schemas"
  task generate_rswag: :environment do
    require_relative "../../spec/support/schemas/inertia/base_schemas"
    require_relative "../../spec/support/schemas/inertia/auth_schema"
    require_relative "../../spec/support/schemas/inertia/brainstorm_schema"
    require_relative "../../spec/support/schemas/inertia/website_schema"
    require_relative "../../spec/support/schemas/inertia/campaigns_schema"
    require_relative "../../spec/support/schemas/inertia/launch_schema"
    require_relative "../../spec/support/schemas/inertia/leads_schema"
    require_relative "../../spec/support/schemas/inertia/settings_schema"
    require_relative "../../spec/support/schemas/inertia/dashboard_schema"
    require_relative "../../spec/support/schemas/inertia/performance_schema"

    generator = InertiaOpenApiGenerator.new

    generator.add_component("SignInProps", InertiaSchemas::SignIn)
    generator.add_component("SignUpProps", InertiaSchemas::SignUp)
    generator.add_component("NewBrainstormProps", InertiaSchemas::NewBrainstorm)
    generator.add_component("BrainstormProps", InertiaSchemas::Brainstorm)
    generator.add_component("WebsiteProps", InertiaSchemas::Website)
    generator.add_component("CampaignsProps", InertiaSchemas::Campaigns)
    generator.add_component("LaunchProps", InertiaSchemas::Launch)
    generator.add_component("LeadsProps", InertiaSchemas::Leads)
    generator.add_component("SettingsProps", InertiaSchemas::Settings)
    generator.add_component("DashboardProps", InertiaSchemas::Dashboard)
    generator.add_component("PerformanceProps", InertiaSchemas::Performance)

    generator.add_page("/users/sign_in", ref: "SignInProps", tag: "Auth Pages", params: [])
    generator.add_page("/users/sign_up", ref: "SignUpProps", tag: "Auth Pages", params: [])

    generator.add_page(
      "/projects/new",
      ref: "NewBrainstormProps",
      tag: "Inertia Pages",
      params: []
    )
    generator.add_page(
      "/projects/{uuid}/brainstorm",
      ref: "BrainstormProps",
      tag: "Inertia Pages",
      params: [UUID_PARAM]
    )
    generator.add_page(
      "/projects/{uuid}/website",
      ref: "WebsiteProps",
      tag: "Inertia Pages",
      params: [UUID_PARAM]
    )
    generator.add_page(
      "/projects/{uuid}/leads",
      ref: "LeadsProps",
      tag: "Inertia Pages",
      params: [UUID_PARAM]
    )
    generator.add_page(
      "/settings",
      ref: "SettingsProps",
      tag: "Inertia Pages",
      params: []
    )
    generator.add_page(
      "/dashboard",
      ref: "DashboardProps",
      tag: "Inertia Pages",
      params: []
    )
    generator.add_page(
      "/projects/{uuid}/performance",
      ref: "PerformanceProps",
      tag: "Inertia Pages",
      params: [UUID_PARAM]
    )

    WorkflowConfig.substeps_for("launch", "ad_campaign").each do |substep|
      generator.add_page(
        "/projects/{uuid}/campaigns/#{substep}",
        ref: "CampaignsProps",
        tag: "Inertia Pages - Campaigns",
        params: [UUID_PARAM]
      )
    end

    WorkflowConfig.substeps_for("launch", "launch").each do |substep|
      generator.add_page(
        "/projects/{uuid}/launch/#{substep}",
        ref: "LaunchProps",
        tag: "Inertia Pages - Launch",
        params: [UUID_PARAM]
      )
    end

    generator.write_to(Rails.root.join("swagger", "v1", "inertia-props.yaml"))
  end

  desc "Generate TypeScript types from OpenAPI spec"
  task generate_typescript: :environment do
    require "open3"

    shared_dir = Rails.root.join("..", "shared").to_s
    stdout, stderr, status = Open3.capture3("pnpm", "run", "types:generate", chdir: shared_dir)

    if status.success?
      puts "Generated TypeScript types from Inertia props OpenAPI spec"
      puts stdout unless stdout.empty?
    else
      warn "Failed to generate TypeScript types:\n#{stderr}"
      exit 1
    end
  end

  desc "Generate OpenAPI YAML and TypeScript types"
  task generate: %i[generate_rswag generate_typescript]
end

class InertiaOpenApiGenerator
  def initialize
    @pages = {}
    @components = {}
  end

  def add_component(name, schema_module)
    @components[name] = convert_schema(schema_module.props_schema)
  end

  def add_page(path, ref:, tag: "Inertia Pages", params: [])
    name = path.split("/").last.titleize
    @pages[path] = {
      get: {
        summary: "#{name} page props",
        tags: [tag],
        parameters: params,
        responses: {
          "200" => {
            description: "#{name} page props",
            content: {
              "application/json" => {
                schema: { "$ref" => "#/components/schemas/#{ref}" }
              }
            }
          }
        }
      }
    }
  end

  def write_to(output_path)
    doc = {
      openapi: "3.0.1",
      info: {
        title: "Inertia Page Props",
        version: "v1",
        description: "Type definitions for Inertia.js page props."
      },
      paths: @pages,
      components: { schemas: @components },
      servers: [{ url: "https://{defaultHost}", variables: { defaultHost: { default: "www.example.com" } } }]
    }

    File.write(output_path, doc.deep_stringify_keys.to_yaml)
    puts "Generated Inertia props OpenAPI spec at #{output_path}"
  end

  private

  def convert_schema(schema)
    case schema
    when Hash
      schema.each_with_object({}) do |(key, value), result|
        str_key = key.to_s
        result[str_key] = case str_key
        when "properties"
          value.transform_keys(&:to_s).transform_values { |v| convert_schema(v) }
        when "required"
          value.map(&:to_s)
        else
          convert_schema(value)
        end
      end
    when Symbol then schema.to_s
    when Array then schema.map { |v| convert_schema(v) }
    else schema
    end
  end
end

Rake::Task["rswag:specs:swaggerize"].enhance do
  Rake::Task["inertia:generate"].invoke
end
