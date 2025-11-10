import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../core/env';

const sql = postgres(env.POSTGRES_URI);
export const db = drizzle(sql, { schema });
export type DB = typeof db;