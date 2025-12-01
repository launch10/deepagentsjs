namespace :faqs do
  desc "Sync FAQs from Google Docs"
  task sync: :environment do
    GoogleDocs::SyncService.perform

    Database::Snapshotter.export_tables(
      "faqs.sql",
      tables: ["documents", "document_chunks"],
      data_only: true
    )
  end
end
