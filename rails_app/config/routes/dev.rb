mount Jumpstart::Engine, at: "/jumpstart"
mount Mailbin::Engine, at: "/mailbin"

mount Rswag::Ui::Engine => '/api-docs'
mount Rswag::Api::Engine => '/api-docs'

authenticated :user do
  resources :uploads, only: [:index]
end
