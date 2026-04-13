import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from './env.js';
import * as schema from '../models/schema.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });
export { pool };
