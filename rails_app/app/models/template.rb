# == Schema Information
#
# Table name: templates
#
#  id         :bigint           not null, primary key
#  name       :string
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_templates_on_name  (name) UNIQUE
#

class Template < ApplicationRecord
  has_many :files, class_name: "TemplateFile"
end
