[![Bolt.new: AI-Powered Full-Stack Web Development in the Browser](./public/social_preview_index.jpg)](https://bolt.new)

# Running locally (dev mode, good for debugging)

WARNING: This is the fastest possible way to run Langgraph, but it does not persist any data (local file-based persistence)

```bash
npx @langchain/langgraph-cli dev # run backend service
NODE_OPTIONS="--inspect-brk" npx @langchain/langgraph-cli dev -n 1 # debug (use 1 worker to avoid debugger issues)
pnpm run dev # run dev server
```

# Running locally w/ Postgres

This is slightly more time-consuming, but it allows you to run the Langgraph server with proper Postgres database.

```bash
langgraph up --no-pull -p 2024 --postgres-uri postgres://host.docker.internal:5432/nichefinder_development -d docker-compose.yml
pnpm run dev
```

# Running locally (Must be rebuilt after code changes):

WARNING: If you do this, YOUR CODE CHANGES WILL NOT BE REFLECTED IN THE APP. You will need to rebuild the app after every code change.
Use langgraph dev to run the backend service.

Run the Langgraph server with the custom Postgres and Redis databases.

1. Ensure .env.docker is configured, using `host.docker.interal` to connect to the host machine (for Redis + Postgres)

```bash
docker build -t nichefinder .
docker compose up
```

2. Run the frontend

```bash
pnpm run dev
```

# Connecting Langgraph to Postgres

1. Ensure Postgres is configured to accept connections from your host machine. (edit the pg_hba.conf + postgresql.conf files)
2. Create langgraph user and grant create + usage on the database to the langgraph user.
3. Copy the docker compose file from: https://langchain-ai.github.io/langgraph/cloud/deployment/standalone_container/
4. Connect in your `POSTGRES_URI`, `DATABASE_URI`, `REDIS_URI` to the docker compose file.
5. Expose port 2024 to the host machine.
6. Run `docker compose up`

# Bolt.new: AI-Powered Full-Stack Web Development in the Browser

Bolt.new is an AI-powered web development agent that allows you to prompt, run, edit, and deploy full-stack applications directly from your browser—no local setup required. If you're here to build your own AI-powered web dev agent using the Bolt open source codebase, [click here to get started!](./CONTRIBUTING.md)

## What Makes Bolt.new Different

Claude, v0, etc are incredible- but you can't install packages, run backends or edit code. That’s where Bolt.new stands out:

- **Full-Stack in the Browser**: Bolt.new integrates cutting-edge AI models with an in-browser development environment powered by **StackBlitz’s WebContainers**. This allows you to:

  - Install and run npm tools and libraries (like Vite, Next.js, and more)
  - Run Node.js servers
  - Interact with third-party APIs
  - Deploy to production from chat
  - Share your work via a URL

- **AI with Environment Control**: Unlike traditional dev environments where the AI can only assist in code generation, Bolt.new gives AI models **complete control** over the entire environment including the filesystem, node server, package manager, terminal, and browser console. This empowers AI agents to handle the entire app lifecycle—from creation to deployment.

Whether you’re an experienced developer, a PM or designer, Bolt.new allows you to build production-grade full-stack applications with ease.

For developers interested in building their own AI-powered development tools with WebContainers, check out the open-source Bolt codebase in this repo!

## Tips and Tricks

Here are some tips to get the most out of Bolt.new:

- **Be specific about your stack**: If you want to use specific frameworks or libraries (like Astro, Tailwind, ShadCN, or any other popular JavaScript framework), mention them in your initial prompt to ensure Bolt scaffolds the project accordingly.

- **Use the enhance prompt icon**: Before sending your prompt, try clicking the 'enhance' icon to have the AI model help you refine your prompt, then edit the results before submitting.

- **Scaffold the basics first, then add features**: Make sure the basic structure of your application is in place before diving into more advanced functionality. This helps Bolt understand the foundation of your project and ensure everything is wired up right before building out more advanced functionality.

- **Batch simple instructions**: Save time by combining simple instructions into one message. For example, you can ask Bolt to change the color scheme, add mobile responsiveness, and restart the dev server, all in one go saving you time and reducing API credit consumption significantly.

## FAQs

**Where do I sign up for a paid plan?**  
Bolt.new is free to get started. If you need more AI tokens or want private projects, you can purchase a paid subscription in your [Bolt.new](https://bolt.new) settings, in the lower-left hand corner of the application.

**What happens if I hit the free usage limit?**  
Once your free daily token limit is reached, AI interactions are paused until the next day or until you upgrade your plan.

**Is Bolt in beta?**  
Yes, Bolt.new is in beta, and we are actively improving it based on feedback.

**How can I report Bolt.new issues?**  
Check out the [Issues section](https://github.com/stackblitz/bolt.new/issues) to report an issue or request a new feature. Please use the search feature to check if someone else has already submitted the same issue/request.

**What frameworks/libraries currently work on Bolt?**  
Bolt.new supports most popular JavaScript frameworks and libraries. If it runs on StackBlitz, it will run on Bolt.new as well.

**How can I add make sure my framework/project works well in bolt?**  
We are excited to work with the JavaScript ecosystem to improve functionality in Bolt. Reach out to us via [hello@stackblitz.com](mailto:hello@stackblitz.com) to discuss how we can partner!
