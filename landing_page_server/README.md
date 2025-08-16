```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

## Uploading A Landing Page (Locally)

```bash
./upload-dist-to-r2.sh path/to/landing/page/dist user-pages/dist
```

## Testing A Deployed Page (Locally)

```bash
pnpm wrangler dev
```
