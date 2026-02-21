require_relative "../../spec/snapshot_builders/base_builder"
require_relative "../../spec/snapshot_builders/core_data"

puts "=== Seeding Production Database ==="

puts "Seeding core data (plans, templates, themes)..."
CoreData.new.build

puts "Seeding geo target constants..."
require_relative "../../spec/snapshot_builders/core/geo_target_constants"
Core::GeoTargetConstants.new.seed

puts "=== Production Seeding Complete ==="
