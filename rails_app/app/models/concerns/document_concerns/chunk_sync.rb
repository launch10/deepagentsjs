module DocumentConcerns
  module ChunkSync
    extend ActiveSupport::Concern

    def sync_chunks(extracted_pairs)
      return chunks if extracted_pairs.blank?

      current_hashes = []

      transaction do
        extracted_pairs.each_with_index do |pair, idx|
          hash = generate_question_hash(pair[:question])
          current_hashes << hash

          chunk = chunks.find_or_initialize_by(question_hash: hash)
          chunk.assign_attributes(
            question: pair[:question],
            answer: pair[:answer],
            section: pair[:section],
            context: pair[:context] || {},
            position: idx
          )
          chunk.save! if chunk.new_record? || chunk.changed?
        end

        chunks.where.not(question_hash: current_hashes).destroy_all
      end

      chunks.reload
    end

    private

    def generate_question_hash(question)
      Digest::SHA256.hexdigest(question.to_s.downcase.strip)
    end
  end
end
