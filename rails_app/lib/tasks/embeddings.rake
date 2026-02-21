namespace :embeddings do
  desc "Backfill embeddings for document_chunks"
  task backfill: :environment do
    puts "Backfilling document_chunks embeddings..."
    DocumentChunk.where(embedding: nil).find_each do |chunk|
      AI::GenerateEmbeddingWorker.perform_async("DocumentChunk", chunk.id)
    end
    puts "Enqueued #{DocumentChunk.where(embedding: nil).count} document_chunk jobs"
    puts "Done! Jobs will process in the background."
  end

  desc "Backfill embeddings synchronously (for seeding)"
  task backfill_sync: :environment do
    puts "Backfilling document_chunks embeddings synchronously..."
    files = DocumentChunk.where(embedding: nil)
    files.find_in_batches(batch_size: 50) do |batch|
      texts = batch.map(&:content)
      embeddings = EmbeddingService.generate_batch(texts)
      batch.each_with_index do |chunk, i|
        next unless embeddings[i]
        vector_literal = "[#{embeddings[i].join(",")}]"
        chunk.class.where(id: chunk.id).update_all(["embedding = ?", vector_literal])
      end
      print "."
    end
    puts "\nDocument chunks done!"
  end
end
