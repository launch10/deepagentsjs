#!/usr/bin/env ruby
# Cleanup old test accounts from MCC before running verification
#
# Usage:
#   bundle exec ruby bin/cleanup_test_accounts.rb --list     # List accounts only
#   bundle exec ruby bin/cleanup_test_accounts.rb --cancel   # Cancel active accounts
#   bundle exec ruby bin/cleanup_test_accounts.rb --unlink   # Unlink all accounts from MCC
#   bundle exec ruby bin/cleanup_test_accounts.rb --hide     # Hide all accounts from MCC view
#   bundle exec ruby bin/cleanup_test_accounts.rb            # Interactive mode
#
# This script:
#   1. Lists all accounts under the Test MCC (124-895-7009)
#   2. Shows their status (ENABLED, CANCELED, CLOSED)
#   3. Can cancel active accounts (sets status to CANCELED)
#   4. Can unlink accounts from MCC (removes them from MCC entirely)
#   5. Can hide accounts from MCC view (keeps link but hides in UI)
#
# Test MCC Account: 124-895-7009

require "rubygems"
require "bundler/setup"
require_relative "../config/environment"

class TestAccountCleanup
  MCC_CUSTOMER_ID = "1248957009" # 124-895-7009 without hyphens

  def initialize
    @client = GoogleAds.client
    @client.configure do |config|
      config.login_customer_id = MCC_CUSTOMER_ID.to_i
    end
  end

  def run
    puts "\n" + "=" * 60
    puts "Google Ads Test Account Cleanup"
    puts "MCC: #{MCC_CUSTOMER_ID}"
    puts "=" * 60

    accounts = list_accounts
    display_accounts(accounts)

    return if accounts.empty?

    puts "\nOptions:"
    puts "  1. Cancel active accounts (sets status to CANCELED, still visible in MCC)"
    puts "  2. Unlink ALL accounts from MCC (removes from MCC entirely)"
    puts "  3. Exit"
    print "\nChoice (1/2/3): "

    choice = gets&.strip

    case choice
    when "1"
      active_accounts = accounts.select { |a| a[:status] == :ENABLED }
      if active_accounts.empty?
        puts "No active accounts to cancel."
      else
        cancel_accounts(active_accounts)
      end
    when "2"
      unlink_accounts(accounts)
    else
      puts "Exiting."
    end
  end

  def list_accounts
    puts "\nFetching accounts under MCC..."

    query = <<~QUERY
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.status,
        customer_client.manager,
        customer_client.test_account
      FROM customer_client
      WHERE customer_client.manager = false
    QUERY

    response = @client.service.google_ads.search(
      customer_id: MCC_CUSTOMER_ID,
      query: query
    )

    accounts = response.map do |row|
      {
        id: row.customer_client.id,
        name: row.customer_client.descriptive_name,
        status: row.customer_client.status,
        test_account: row.customer_client.test_account
      }
    end

    accounts.sort_by { |a| a[:name].to_s }
  rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
    puts "Error fetching accounts: #{e.message}"
    []
  end

  def display_accounts(accounts)
    puts "\n" + "-" * 60
    puts "Accounts under MCC"
    puts "-" * 60

    if accounts.empty?
      puts "No accounts found. MCC is clean!"
      return
    end

    accounts.each do |account|
      status_icon = case account[:status]
      when :ENABLED then "🟢"
      when :CANCELED, :CLOSED then "🔴"
      else "⚪"
      end

      test_badge = account[:test_account] ? " [TEST]" : ""
      puts "  #{status_icon} #{account[:id]}: #{account[:name]} (#{account[:status]})#{test_badge}"
    end

    puts "\nTotal: #{accounts.count} accounts"
    puts "  Active: #{accounts.count { |a| a[:status] == :ENABLED }}"
    puts "  Canceled/Closed: #{accounts.count { |a| [:CANCELED, :CLOSED].include?(a[:status]) }}"
  end

  def cancel_accounts(accounts)
    puts "\nCanceling #{accounts.count} account(s)..."

    accounts.each do |account|
      print "  Canceling #{account[:id]} (#{account[:name]})... "
      begin
        cancel_account(account[:id])
        puts "✅ Done"
      rescue => e
        puts "❌ Failed: #{e.message}"
      end
    end

    puts "\nCancel complete."
  end

  def cancel_account(customer_id)
    client = GoogleAds.client
    client.configure do |config|
      config.login_customer_id = MCC_CUSTOMER_ID.to_i
    end

    operation = client.operation.update_resource.customer("customers/#{customer_id}") do |c|
      c.status = :CANCELED
    end

    client.service.customer.mutate_customer(
      customer_id: customer_id.to_s,
      operation: operation
    )
  end

  def unlink_accounts(accounts)
    puts "\nUnlinking #{accounts.count} account(s) from MCC..."
    puts "This will remove them from the MCC entirely.\n"

    accounts.each do |account|
      print "  Unlinking #{account[:id]} (#{account[:name]})... "
      begin
        unlink_account(account[:id])
        puts "✅ Done"
      rescue => e
        puts "❌ Failed: #{e.message}"
      end
    end

    puts "\nUnlink complete. Accounts removed from MCC."
  end

  def unlink_account(client_customer_id)
    # Step 1: Find the manager link ID
    manager_link = find_manager_link(client_customer_id)

    unless manager_link
      raise "No manager link found for customer #{client_customer_id}"
    end

    # Step 2: Set the link status to INACTIVE (terminates the relationship)
    # Must authenticate as the CLIENT account to modify the link
    client = GoogleAds.client
    client.configure do |config|
      config.login_customer_id = client_customer_id.to_i
    end

    manager_link_resource = client.path.customer_manager_link(
      client_customer_id.to_s,
      MCC_CUSTOMER_ID,
      manager_link[:manager_link_id].to_s
    )

    operation = client.operation.update_resource.customer_manager_link(manager_link_resource) do |link|
      link.status = :INACTIVE
    end

    client.service.customer_manager_link.mutate_customer_manager_link(
      customer_id: client_customer_id.to_s,
      operations: [operation]
    )
  end

  def find_manager_link(client_customer_id)
    # Query the customer_manager_link from the client account's perspective
    client = GoogleAds.client
    client.configure do |config|
      config.login_customer_id = client_customer_id.to_i
    end

    query = <<~QUERY
      SELECT
        customer_manager_link.manager_customer,
        customer_manager_link.manager_link_id,
        customer_manager_link.status
      FROM customer_manager_link
      WHERE customer_manager_link.manager_customer = 'customers/#{MCC_CUSTOMER_ID}'
    QUERY

    response = client.service.google_ads.search(
      customer_id: client_customer_id.to_s,
      query: query
    )

    row = response.first
    return nil unless row

    {
      manager_customer: row.customer_manager_link.manager_customer,
      manager_link_id: row.customer_manager_link.manager_link_id,
      status: row.customer_manager_link.status
    }
  rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
    puts "\n    Warning: Could not query manager link: #{e.message}"
    nil
  end

  # List accounts only (no cleanup prompt)
  def list_only
    puts "\n" + "=" * 60
    puts "Google Ads Test Accounts"
    puts "MCC: #{MCC_CUSTOMER_ID}"
    puts "=" * 60

    accounts = list_accounts
    display_accounts(accounts)
    accounts
  end

  # Cancel all active accounts (non-interactive)
  def cancel_all
    puts "\n" + "=" * 60
    puts "Google Ads Test Account Cleanup - Cancel Mode"
    puts "MCC: #{MCC_CUSTOMER_ID}"
    puts "=" * 60

    accounts = list_accounts
    active_accounts = accounts.select { |a| a[:status] == :ENABLED }

    if active_accounts.empty?
      puts "\nNo active accounts to cancel."
      return
    end

    cancel_accounts(active_accounts)
  end

  # Unlink all accounts (non-interactive)
  def unlink_all
    puts "\n" + "=" * 60
    puts "Google Ads Test Account Cleanup - Unlink Mode"
    puts "MCC: #{MCC_CUSTOMER_ID}"
    puts "=" * 60

    accounts = list_accounts

    if accounts.empty?
      puts "\nNo accounts to unlink. MCC is clean!"
      return
    end

    unlink_accounts(accounts)
  end

  # Hide all accounts (non-interactive)
  def hide_all
    puts "\n" + "=" * 60
    puts "Google Ads Test Account Cleanup - Hide Mode"
    puts "MCC: #{MCC_CUSTOMER_ID}"
    puts "=" * 60

    accounts = list_accounts

    if accounts.empty?
      puts "\nNo accounts to hide. MCC is clean!"
      return
    end

    hide_accounts(accounts)
  end

  def hide_accounts(accounts)
    puts "\nHiding #{accounts.count} account(s) from MCC view..."

    accounts.each do |account|
      print "  Hiding #{account[:id]} (#{account[:name]})... "
      begin
        result = hide_account(account[:id])
        if result == :already_hidden
          puts "✅ Already hidden"
        else
          puts "✅ Done"
        end
      rescue => e
        puts "❌ Failed: #{e.message}"
      end
    end

    puts "\nHide complete. Accounts hidden from MCC view."
  end

  def hide_account(client_customer_id)
    query = <<~QUERY
      SELECT customer_client_link.resource_name, customer_client_link.hidden
      FROM customer_client_link
      WHERE customer_client_link.client_customer = 'customers/#{client_customer_id}'
    QUERY

    response = @client.service.google_ads.search(
      customer_id: MCC_CUSTOMER_ID,
      query: query
    )

    link = response.first&.customer_client_link
    raise "No link found" unless link

    if link.hidden
      return :already_hidden
    end

    operation = @client.operation.update_resource.customer_client_link(link.resource_name) do |l|
      l.hidden = true
    end

    @client.service.customer_client_link.mutate_customer_client_link(
      customer_id: MCC_CUSTOMER_ID,
      operation: operation
    )
  end
end

# Run the cleanup
if __FILE__ == $0
  cleanup = TestAccountCleanup.new

  if ARGV.include?("--list")
    cleanup.list_only
  elsif ARGV.include?("--cancel")
    cleanup.cancel_all
  elsif ARGV.include?("--unlink")
    cleanup.unlink_all
  elsif ARGV.include?("--hide")
    cleanup.hide_all
  else
    cleanup.run
  end
end
