import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';
import { env } from '@lib/env';

export default defineConfig({
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.POSTGRES_URI
  },
  verbose: true,
  strict: true
});
