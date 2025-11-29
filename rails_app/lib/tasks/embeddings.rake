namespace :embeddings do
  desc "Backfill embeddings for template_files and website_files"
  task backfill: :environment do
    puts "Backfilling template_files embeddings..."
    TemplateFile.where(embedding: nil).find_each do |file|
      AI::GenerateEmbeddingWorker.perform_async("TemplateFile", file.id)
    end
    puts "Enqueued #{TemplateFile.where(embedding: nil).count} template_file jobs"

    puts "Backfilling website_files embeddings..."
    WebsiteFile.where(embedding: nil).find_each do |file|
      AI::GenerateEmbeddingWorker.perform_async("WebsiteFile", file.id)
    end
    puts "Enqueued #{WebsiteFile.where(embedding: nil).count} website_file jobs"

    puts "Done! Jobs will process in the background."
  end

  desc "Backfill embeddings synchronously (for seeding)"
  task backfill_sync: :environment do
    puts "Backfilling template_files embeddings synchronously..."
    files = TemplateFile.where(embedding: nil)
    files.find_in_batches(batch_size: 50) do |batch|
      texts = batch.map(&:content)
      embeddings = EmbeddingService.generate_batch(texts)
      batch.each_with_index do |file, i|
        next unless embeddings[i]
        vector_literal = "[#{embeddings[i].join(',')}]"
        file.class.where(id: file.id).update_all(["embedding = ?", vector_literal])
      end
      print "."
    end
    puts "\nTemplate files done!"

    puts "Backfilling website_files embeddings synchronously..."
    files = WebsiteFile.where(embedding: nil)
    files.find_in_batches(batch_size: 50) do |batch|
      texts = batch.map(&:content)
      embeddings = EmbeddingService.generate_batch(texts)
      batch.each_with_index do |file, i|
        next unless embeddings[i]
        vector_literal = "[#{embeddings[i].join(',')}]"
        file.class.where(id: file.id).update_all(["embedding = ?", vector_literal])
      end
      print "."
    end
    puts "\nWebsite files done!"
  end
end
