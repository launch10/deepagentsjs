authenticated :user do
  root to: "projects#new", as: :onboarding

  resource :settings, only: [:show, :update] do
    patch :update_password, on: :member
  end

  resource :support, only: [:show, :create], controller: "support"

  get "dashboard", to: "dashboard#show"

  resources :projects, only: [:index, :new, :show, :destroy], param: :uuid do
    resources :workflows, only: [:show]

    member do
      get :brainstorm
      get :performance

      # Website substeps (build, domain, deploy)
      scope :website do
        WorkflowConfig.substeps_for("launch", "website").each do |substep|
          get substep, to: "projects#website_#{substep}", as: "website_#{substep}"
        end
      end
      # Backwards compatibility: redirect /website to /website/build
      get :website, to: redirect { |params, _req| "/projects/#{params[:uuid]}/website/build" }

      scope :campaigns do
        WorkflowConfig.substeps_for("launch", "ads").each do |substep|
          get substep, to: "projects#campaigns_#{substep}", as: "campaigns_#{substep}"
        end
      end

      get :deploy
      patch :restore
    end

    resources :leads, only: [:index], controller: "leads" do
      collection do
        get :export
      end
    end
  end
end
