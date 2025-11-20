# == Schema Information
#
# Table name: icon_embeddings
#
#  id         :bigint           not null, primary key
#  embedding  :vector(1536)     not null
#  key        :string           not null
#  metadata   :jsonb            not null
#  text       :text             not null
#  created_at :datetime
#
# Indexes
#
#  idx_icon_embeddings_text      (embedding) USING ivfflat
#  index_icon_embeddings_on_key  (key) UNIQUE
#

class IconEmbedding < ApplicationRecord
  has_neighbors :embedding

  scope :random, -> { order(Arel.sql("RANDOM()")) }
end
