namespace :faqs do
  desc "Sync FAQs from Google Docs and export to seed file"
  task sync: :environment do
    service = GoogleDocs::SyncService.new
    results = service.sync_all(force: true)
    puts "Sync results: #{results}"
  end

  desc "Export current documents and chunks to db/seeds/faqs.sql"
  task export: :environment do
    output_path = Rails.root.join("db/seeds/faqs.sql")
    Database::Snapshotter.export_tables(
      output_path.to_s,
      tables: %w[documents document_chunks],
      data_only: true,
      inserts: true,
      column_inserts: true
    )
    puts "Exported FAQs to #{output_path}"
  end

  desc "Sync from Google Docs and export"
  task sync_and_export: [:sync, :export]
end
