# 🎉 Jumpstart Pro Rails

Welcome! To get started, clone the repository and push it to a new repository.

## Requirements

You'll need the following installed to run the template successfully:

- Ruby 3.2+
- PostgreSQL 12+ (can be switched to SQLite or MySQL)
- Libvips or Imagemagick

Optionally, the [Stripe CLI](https://docs.stripe.com/stripe-cli) to sync webhooks in development.

## Creating A Subscribed User

Subscribed endpoints require a user to be subscribed to a plan.

1. On Stripe, create a sandbox environment, and ensure you enter details like privacy policy (https://example.com/privacy-policy) and terms of service (https://example.com/terms-of-service).

2. Create a sample Price, and copy the `Price ID` from the Stripe dashboard.

3. Copy the API key from the Stripe dashboard, and run `rails credentials:edit --environment=development` to add it to your credentials under Stripe (Publishable Key = "Public Key", Secret Key = "Secret Key")

4. Run `stripe login` and open the link in your browser. Accept the permissions.

5. Run `bin/dev`, and copy the `Webhook Signing Secret` that's output. Copy this to your Rails credentials under Stripe (Signing Secret).

6. On JumpStart Pro, create a user (localhost:3000/users/new)

7. In Rails console, assign them admin permissions (if you want an admin), and create an account for them

8. In Jumpstart Pro, navigate to http://localhost:3000/admin/plans, and create a plan with the Price ID you copied from Stripe.

9. In Jumpstart Pro, navigate to http://localhost:3000/subscriptions, and subscribe to the plan you created, entering 4242 4242 4242 4242 for the card number, and a fake expiration date.

10. If successful, you should be able to query: `User.find_by_email("YOUR_EMAIL").accounts.last.subscriptions`

11. You should also now be able to access `SubscribedController` endpoints (e.g. `localhost:3000/projects`)

## Create Your Repository

Create a [new Git](https://github.com/new) repository for your project. Then you can clone Jumpstart Pro and push it to your new repository.

```bash
git clone https://github.com/jumpstart-pro/jumpstart-pro-rails.git myapp
cd myapp
git remote rename origin jumpstart-pro
git remote add origin https://github.com/your-account/your-repo.git # Replace with your new Git repository url
git push -u origin main
```

## Initial Setup

First, edit `config/database.yml` and change the database credentials for your server.

Run `bin/setup` to install Ruby and JavaScript dependencies and setup your database.

```bash
bin/setup
```

## Running Jumpstart Pro Rails

To run your application, you'll use the `bin/dev` command:

```bash
bin/dev
```

This starts up Overmind running the processes defined in `Procfile.dev`. We've configured this to run the Rails server, CSS bundling, and JS bundling out of the box. You can add background workers like Sidekiq, the Stripe CLI, etc to have them run at the same time.

#### Running on Windows

See the [Installation docs](https://jumpstartrails.com/docs/installation#windows)

#### Running with Docker or Docker Compose

See the [Installation docs](https://jumpstartrails.com/docs/installation#docker)

## Merging Updates

To merge changes from Jumpstart Pro, you will merge from the `jumpstart-pro` remote.

```bash
git fetch jumpstart-pro
git merge jumpstart-pro/main
```

## Contributing

If you have an improvement you'd like to share, create a fork of the repository and send us a pull request.
