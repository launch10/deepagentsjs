# Firewall

One of the major risks of our project is that individual users will have website that receive too much traffic, resulting in massive Cloudflare bills. To prevent this, we will implement a firewall that will limit the number of requests a website can receive.

## Control Mechanisms

The account's plan will determine the number of requests it can receive, using PlanLimits.

```ruby
PlanLimit.create(
    plan: Plan.find_by(name: "starter"),
    limit_type: "requests_per_month",
    limit: 1_000_000
)

account = Account.find_by(name: "Test Account")
account.over_monthly_request_limit?
```

## Request Counting

We count requests using the Cloudflare Analytics API. This happens every 5 minutes, inside `schedule.rb`:

```ruby
every(5.minutes, "monitor cloudflare domains") do
  Domain.monitor_cloudflare_domains
end
```

This will continually update the request counts for each domain, and subsequently update the account's request count.

```ruby
account.over_monthly_request_limit?
```

If the account's request count exceeds the limit, the firewall will be triggered, and the account will be blocked from receiving any more requests.

```ruby
Cloudflare::Firewall.block_account(account)
# This calls through to
Cloudflare::FirewallService.block_domains(domains)
```

## Unblocking

If the account's request count drops below the limit, the firewall will automatically be unblocked using the same request-counting process, and the account will be able to receive requests again.

```ruby
Cloudflare::Firewall.unblock_account(account)
# This calls through to
Cloudflare::FirewallService.unblock_domains(cloudflare_rule_ids)
```

## Manual Blocking and Unblocking

- We don't currently have a way to manually block or unblock an account (since the user's limits will determine this),
  but one simple way to add it is to extend user's plan limits with "Credits Purchases".

- CreditsPurchases would grant an additional number of requests to the user's account, (or optionally a negative number of requests to forcibly block them).

- We would need to add logic to `AccountConcerns::TrafficLimits#monthly_request_count` to account for the credits purchases.
