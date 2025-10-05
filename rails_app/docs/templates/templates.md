# Templates

This project is used to build websites for users. Templates are the boilerplate starting point for a website.

In the rails app, we have a `templates` directory which is the source of truth. If you want to edit any templates, do so in the `templates` directory, and run `bundle exec rake seeds:template` to sync them to the database.

Before merging to production, run `bundle exec rake seeds:template` to sync templates to the database.
