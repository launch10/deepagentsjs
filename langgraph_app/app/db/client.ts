import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../core/env';
import { withTimestamps } from './withTimestamps';

const sql = postgres(env.POSTGRES_URI);
const baseDb = drizzle(sql, { schema });
export const db = withTimestamps(baseDb);

export type DB = typeof baseDb;