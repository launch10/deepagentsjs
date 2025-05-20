# == Schema Information
#
# Table name: file_specifications
#
#  id             :integer          not null, primary key
#  canonical_path :string
#  description    :string
#  filetype       :string
#  subtype        :string
#  language       :string
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#
# Indexes
#
#  index_file_specifications_on_canonical_path  (canonical_path)
#  index_file_specifications_on_filetype        (filetype)
#  index_file_specifications_on_subtype         (subtype)
#

class FileSpecification < ApplicationRecord
end
