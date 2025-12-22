namespace :uploads do
  desc "Clean up test uploads from public/uploads directory"
  task :clean do
    uploads_dir = Rails.root.join("public/uploads")
    
    if uploads_dir.exist?
      puts "Cleaning #{uploads_dir}..."
      FileUtils.rm_rf(uploads_dir)
      puts "Done. Removed #{uploads_dir}"
    else
      puts "No uploads directory found at #{uploads_dir}"
    end
  end
end
