# == Schema Information
#
# Table name: icon_embeddings
#
#  id         :integer          not null, primary key
#  key        :string           not null
#  text       :text             not null
#  embedding  :vector(1536)     not null
#  metadata   :jsonb            default("{}"), not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  idx_icon_embeddings_text      (embedding)
#  index_icon_embeddings_on_key  (key) UNIQUE
#

class IconEmbedding < ApplicationRecord
end
