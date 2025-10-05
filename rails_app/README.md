# 🎉 Jumpstart Pro Rails

Welcome! To get started, clone the repository and push it to a new repository.

## Requirements

You'll need the following installed to run the template successfully:

- Ruby 3.2+
- PostgreSQL 12+ (can be switched to SQLite or MySQL)
- Libvips or Imagemagick
- Git LFS

Optionally, the [Stripe CLI](https://docs.stripe.com/stripe-cli) to sync webhooks in development.

## Getting Started

1. Clone the repository
2. Run `bin/setup`

## On Every Merge

After pulling main, you should always run:

```bash
bundle install # sync gems
bundle exec rake db:migrate # sync database
bundle exec rake seeds:template # sync templates
```

## Templates Are The Source of Truth

In the rails app, we have a `templates` directory which is the source of truth. If you want to edit any templates, do so in the `templates` directory, and run `bundle exec rake seeds:template` to sync them to the database.

This allows us to approve template changes in pull requests.

We then sync templates when merging to production.

## Database Snapshots

To pull snapshots from Git LFS: `git lfs pull`
To create a snapshot, run `bin/rails db:snapshot`.
To load a snapshot, run `bin/rails db:restore_snapshot`.

## Creating A Subscribed User

Subscribed endpoints require a user to be subscribed to a plan.

1. On Stripe, create a sandbox environment (https://dashboard.stripe.com/test/products), and ensure you enter details like privacy policy (https://example.com/privacy-policy) and terms of service (https://example.com/terms-of-service). MAKE ABSOLUTELY SURE YOU LOGIN TO SANDBOX... NOT JUST TEST! CLICK THE BUTTON IN THE SIDEBAR THAT SAYS "SANDBOX", don't just navigate to the URL!

2. Create a sample Price (e.g. $49/month for Starter Plan), and copy the `Price ID` from the Stripe dashboard (e.g.
   price_1RQXb4RprCIA8pPkGvSp8eoz NOT prod_SLE3hs6ILQzxrS)

3. Copy the API key from the Stripe dashboard, and run `rails credentials:edit --environment=development` to add it to your credentials under Stripe (Publishable Key = "Public Key", Secret Key = "Secret Key")

4. Run `stripe login` and open the link in your browser. Accept the permissions.

5. Run `bin/dev`, and copy the `Webhook Signing Secret` that's output. Copy this to your Rails credentials under Stripe (Signing Secret).

6. On JumpStart Pro, create a user (localhost:3000/users/sign_up)

7. In Rails console, assign them admin permissions (if you want an admin), and create an account for them (http://localhost:3000/jumpstart/docs/roles)

```ruby
user = User.find_by_email("YOUR_EMAIL")
Jumpstart.grant_system_admin! user
user.accounts.create(name: "YOUR_ACCOUNT_NAME")
```

8. In Jumpstart Pro, navigate to http://localhost:3000/admin/plans, and create a plan with the Price ID you copied from Stripe.

9. In Jumpstart Pro, navigate to http://localhost:3000/subscriptions, and subscribe to the plan you created, entering 4242 4242 4242 4242 for the card number, and a fake expiration date.

10. If successful, you should be able to query: `User.find_by_email("YOUR_EMAIL").accounts.last.subscriptions`

11. You should also now be able to access `SubscribedController` endpoints (e.g. `localhost:3000/projects`)

#### Running on Windows

See the [Installation docs](https://jumpstartrails.com/docs/installation#windows)

#### Running with Docker or Docker Compose

See the [Installation docs](https://jumpstartrails.com/docs/installation#docker)
