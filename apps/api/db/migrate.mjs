// Minimal forward-only SQL migration runner.
// Usage: DATABASE_URL=postgres://... node db/migrate.mjs
// NOT YET INTEGRATION-TESTED (no Docker/Postgres on the dev machine at
// scaffold time) — verify against a real database before relying on it.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const applied = new Set(
    (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
  );
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`applying ${file} ...`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
  console.log('migrations up to date');
} finally {
  await client.end();
}
