require_relative "../spec/snapshot_builders/base_builder"
require_relative "../spec/snapshot_builders/core_data"
require_relative "../spec/snapshot_builders/basic_account"

puts "=== Seeding Database ==="

puts "Seeding core data (plans, templates, themes)..."
CoreData.new.build

puts "Seeding basic account..."
BasicAccount.new.build

puts "=== Seeding Complete ==="
