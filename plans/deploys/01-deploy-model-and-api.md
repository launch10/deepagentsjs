# Deploy Model & API Implementation

## Overview

The Deploy model is a parent record that tracks the overall launch flow history. Each time a user clicks "Deploy", a new Deploy record is created to track that deployment attempt.

## Model Schema

```ruby
# rails_app/app/models/deploy.rb
class Deploy < ApplicationRecord
  STATUS = %w[pending running completed failed].freeze

  belongs_to :project
  belongs_to :website_deploy, class_name: "WebsiteDeploy", optional: true
  belongs_to :campaign_deploy, optional: true

  validates :status, presence: true, inclusion: { in: STATUS }

  scope :live, -> { where(is_live: true) }
  scope :in_progress, -> { where(status: %w[pending running]) }
  scope :latest, -> { order(created_at: :desc).first }
end
```

## Migration

```ruby
# rails_app/db/migrate/xxx_create_deploys.rb
class CreateDeploys < ActiveRecord::Migration[8.0]
  def change
    create_table :deploys do |t|
      t.references :project, null: false, foreign_key: true
      t.string :status, null: false, default: "pending"
      t.string :current_step
      t.boolean :is_live, default: false
      t.text :stacktrace
      t.references :website_deploy, foreign_key: { to_table: :website_deploys }, optional: true
      t.references :campaign_deploy, foreign_key: true, optional: true
      t.string :langgraph_thread_id

      t.timestamps
    end

    add_index :deploys, [:project_id, :is_live]
    add_index :deploys, [:project_id, :status]
  end
end
```

## Project Association

```ruby
# rails_app/app/models/project.rb
class Project < ApplicationRecord
  has_many :deploys, dependent: :destroy

  def active_deploy
    deploys.in_progress.latest || deploys.latest
  end

  def live_deploy
    deploys.live.latest
  end
end
```

## API Endpoints

### POST /api/v1/deploys

Creates a new Deploy record and returns its ID.

```ruby
# rails_app/app/controllers/api/v1/deploys_controller.rb
class API::V1::DeploysController < API::BaseController
  before_action :set_project

  # POST /api/v1/deploys
  def create
    deploy = @project.deploys.create!(status: "pending")
    render json: {
      id: deploy.id,
      status: deploy.status,
      project_id: @project.id
    }
  end

  # GET /api/v1/deploys/:id
  def show
    deploy = current_account.deploys.find(params[:id])
    render json: deploy_json(deploy)
  end

  private

  def set_project
    @project = current_account.projects.find(params[:project_id])
  end

  def deploy_json(deploy)
    {
      id: deploy.id,
      status: deploy.status,
      current_step: deploy.current_step,
      is_live: deploy.is_live,
      website_deploy_id: deploy.website_deploy_id,
      campaign_deploy_id: deploy.campaign_deploy_id,
      langgraph_thread_id: deploy.langgraph_thread_id,
      created_at: deploy.created_at,
      updated_at: deploy.updated_at
    }
  end
end
```

### Routes

```ruby
# rails_app/config/routes.rb
namespace :api do
  namespace :v1 do
    resources :deploys, only: [:create, :show]
  end
end
```
