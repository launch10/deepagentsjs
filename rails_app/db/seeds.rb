puts "Seeding core data..."
Rake::Task["seeds:core_data"].invoke
puts "Seeding templates..."
Rake::Task["seeds:template"].invoke
puts "Seeding plans..."
Rake::Task["seeds:plans"].invoke
puts "Seeding basic account..."
Rake::Task["seeds:basic_account"].invoke
puts "Seeding themes..."
Rake::Task["seeds:themes"].invoke
