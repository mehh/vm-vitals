/**
 * One tiny query() over two drivers:
 *  - DATABASE_URL set   -> node-postgres Pool (Neon, Vercel Postgres, anything)
 *  - DATABASE_URL unset -> embedded PGlite in web/.data/pglite (zero-config dev)
 * Both accept $1-style params and return { rows }.
 */
import "server-only";

export type Row = Record<string, unknown>;

interface Driver {
  query<T extends object = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

type G = typeof globalThis & { __vvDriver?: Promise<Driver> };
const g = globalThis as G;

async function makeDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  let driver: Driver;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      max: 5,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
    driver = {
      async query(sql, params) {
        const r = await pool.query(sql, params);
        return { rows: r.rows };
      },
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const dir = path.join(process.cwd(), ".data", "pglite");
    fs.mkdirSync(dir, { recursive: true });
    const db = await PGlite.create(dir);
    driver = {
      async query(sql, params) {
        const r = await db.query(sql, params);
        return { rows: r.rows as never[] };
      },
    };
  }
  await migrate(driver);
  return driver;
}

export function getDriver(): Promise<Driver> {
  if (!g.__vvDriver) {
    // Don't cache a failed init (e.g. bad DATABASE_URL): let the next call retry.
    g.__vvDriver = makeDriver().catch((e) => {
      g.__vvDriver = undefined;
      throw e;
    });
  }
  return g.__vvDriver;
}

export async function q<T extends object = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const d = await getDriver();
  const r = await d.query<T>(sql, params);
  return r.rows;
}

export async function one<T extends object = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pair_tokens (
  token       TEXT PRIMARY KEY,
  owner_key   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at     TIMESTAMPTZ,
  machine_id  TEXT
);
CREATE TABLE IF NOT EXISTS machines (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  hostname      TEXT,
  os            TEXT,
  arch          TEXT,
  token_hash    TEXT NOT NULL,
  owner_key     TEXT NOT NULL,
  owner_email   TEXT,
  share_slug    TEXT UNIQUE,
  share_public  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ,
  last_report   JSONB,
  agent_version TEXT
);
CREATE INDEX IF NOT EXISTS machines_owner_key ON machines(owner_key);
CREATE INDEX IF NOT EXISTS machines_owner_email ON machines(owner_email);
CREATE TABLE IF NOT EXISTS samples (
  id          BIGSERIAL PRIMARY KEY,
  machine_id  TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  at          TIMESTAMPTZ NOT NULL,
  cpu_pct     REAL,
  mem_pct     REAL,
  disk_pct    REAL,
  swap_pct    REAL,
  load1       REAL,
  mem_used_b  BIGINT,
  disk_used_b BIGINT,
  oom_kills   BIGINT,
  jobs        INT
);
CREATE INDEX IF NOT EXISTS samples_machine_at ON samples(machine_id, at DESC);
CREATE TABLE IF NOT EXISTS alerts (
  id          BIGSERIAL PRIMARY KEY,
  machine_id  TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  severity    TEXT NOT NULL,
  message     TEXT NOT NULL,
  dedupe_key  TEXT NOT NULL,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS alerts_machine ON alerts(machine_id, opened_at DESC);
CREATE TABLE IF NOT EXISTS incidents (
  id          TEXT PRIMARY KEY,
  machine_id  TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  what_broke  TEXT,
  what_fixed  TEXT,
  severity    TEXT NOT NULL DEFAULT 'minor',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incidents_machine ON incidents(machine_id, started_at DESC);
CREATE TABLE IF NOT EXISTS magic_links (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  owner_key   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
`;

async function migrate(d: Driver) {
  for (const stmt of SCHEMA.split(";")) {
    const s = stmt.trim();
    if (s) await d.query(s);
  }
}
