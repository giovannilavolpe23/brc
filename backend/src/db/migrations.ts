import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

export async function ensureMigrationTable(pool: Pool): Promise<void> {
  await pool.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

export async function runMigrations(pool: Pool): Promise<string[]> {
  await ensureMigrationTable(pool);

  const migrationsDir = path.resolve(__dirname, "../../migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied: string[] = [];

  for (const file of files) {
    const existing = await pool.query("select 1 from schema_migrations where id = $1", [file]);
    if (existing.rowCount) continue;

    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (id) values ($1)", [file]);
      await client.query("commit");
      applied.push(file);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  return applied;
}
