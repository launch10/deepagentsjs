# == Schema Information
#
# Table name: projects
#
#  id         :integer          not null, primary key
#  name       :string           not null
#  account_id :integer          not null
#  theme_id   :integer          not null
#  thread_id  :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_projects_on_account_id                 (account_id)
#  index_projects_on_account_id_and_created_at  (account_id,created_at)
#  index_projects_on_account_id_and_name        (account_id,name) UNIQUE
#  index_projects_on_account_id_and_thread_id   (account_id,thread_id) UNIQUE
#  index_projects_on_account_id_and_updated_at  (account_id,updated_at)
#  index_projects_on_created_at                 (created_at)
#  index_projects_on_name                       (name)
#  index_projects_on_theme_id                   (theme_id)
#  index_projects_on_thread_id                  (thread_id)
#  index_projects_on_updated_at                 (updated_at)
#

class Project < ApplicationRecord
  acts_as_tenant :account
end
