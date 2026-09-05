import { Pool } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function checkDatabaseConnection(): Promise<void> {
  await pool.query("select 1");
}
