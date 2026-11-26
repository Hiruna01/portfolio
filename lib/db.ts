import "server-only";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { isMainThread } from "node:worker_threads";
import { articles } from "@/content/articles";
import { posts } from "@/content/posts";
import { profile } from "@/content/profile";
import { projects } from "@/content/projects";
import { defaultAgentSettings } from "./schemas";

// One small query interface over three Postgres drivers:
//   - Neon's serverless HTTP driver when DATABASE_URL points at Neon (*.neon.tech).
//   - postgres.js for any other DATABASE_URL, such as Supabase. On Vercel, use Supabase's transaction
//     pooler (port 6543); prepared statements are off because that pooler does not keep them.
//   - PGlite, an embedded Postgres stored in .data/, for local development with no setup.
// Tables are created and seeded from content/ the first time a database is used.

type Row = Record<string, unknown>;
type Driver = { query: (text: string, params?: unknown[]) => Promise<Row[]> };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS items (
     id text PRIMARY KEY,
     type text NOT NULL,
     position integer NOT NULL DEFAULT 0,
     data jsonb NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS items_type_position ON items (type, position)`,
  `CREATE TABLE IF NOT EXISTS settings (
     key text PRIMARY KEY,
     value jsonb NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash text PRIMARY KEY,
     created_at timestamptz NOT NULL DEFAULT now(),
     expires_at timestamptz NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS attempts (
     id bigserial PRIMARY KEY,
     bucket text NOT NULL,
     at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS attempts_bucket_at ON attempts (bucket, at)`,
  `CREATE TABLE IF NOT EXISTS audit (
     id bigserial PRIMARY KEY,
     at timestamptz NOT NULL DEFAULT now(),
     action text NOT NULL,
     detail text NOT NULL DEFAULT ''
   )`,
  // Row-level security with no policies: Supabase serves tables in the public schema through its
  // Data API to anyone with the project's public key, so without this they could be read and changed
  // from outside the site. The site connects as the database owner, which is not affected.
  // Harmless on Neon and PGlite.
  ...["items", "settings", "sessions", "attempts", "audit"].map((table) => `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`),
];

async function prepare(driver: Driver): Promise<void> {
  const [{ ready }] = await driver.query(`SELECT to_regclass('public.audit') IS NOT NULL AS ready`);
  if (ready) return;

  for (const statement of SCHEMA) await driver.query(statement);

  // First run: copy the starter content in. ON CONFLICT keeps this safe if two servers start at once.
  const seed: [string, { id: string }[]][] = [
    ["project", projects],
    ["article", articles],
    ["content", posts],
  ];
  for (const [type, list] of seed) {
    for (const [position, item] of list.entries()) {
      await driver.query(
        `INSERT INTO items (id, type, position, data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO NOTHING`,
        [item.id, type, position, JSON.stringify(item)],
      );
    }
  }
  for (const [key, value] of [
    ["profile", profile],
    ["agent", defaultAgentSettings],
  ] as const) {
    await driver.query(`INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`, [key, JSON.stringify(value)]);
  }
}

async function connect(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  let driver: Driver;

  if (url && /\.neon\.tech$/i.test(new URL(url).hostname)) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    driver = { query: (text, params = []) => sql.query(text, params) as Promise<Row[]> };
  } else if (url) {
    const { default: postgres } = await import("postgres");
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname);
    const sql = postgres(url, {
      prepare: false,
      ssl: local ? false : "require",
      max: 3,
      idle_timeout: 20,
      // This code already sends JSON as text (for $n::jsonb), as Neon and PGlite expect. postgres.js would
      // encode that text a second time and store a JSON string instead of the object, so pass strings through.
      types: {
        json: {
          to: 114,
          from: [114, 3802],
          serialize: (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value)),
          parse: (value: string) => JSON.parse(value),
        },
      },
    });
    driver = { query: async (text, params = []) => [...(await sql.unsafe(text, params as never[]))] as Row[] };
  } else {
    if (process.env.VERCEL) {
      throw new Error("DATABASE_URL is not set. Add your Postgres connection string (Supabase or Neon) to the project's environment variables.");
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(".data", { recursive: true });
    claimLocalDatabase();
    const local = new PGlite(".data/pglite");
    driver = { query: async (text, params = []) => (await local.query(text, params)).rows as Row[] };
  }

  await prepare(driver);
  return driver;
}

/**
 * True inside one of the helper workers Next.js runs beside the dev server: "use cache" probes and dev
 * validation (worker threads), and the generateStaticParams worker (a child process running jest-worker's
 * processChild.js, without JEST_WORKER_ID). Each loads this module afresh with its own globalThis, so if it
 * opened the local database it would be a second PGlite instance on the same files, which corrupts them.
 * Workers read the starter content instead. (NEXT_PRIVATE_WORKER is no use here: the main dev server has it too.)
 */
const inHelperWorker =
  !isMainThread || Boolean(process.env.JEST_WORKER_ID) || /[\\/]jest-worker[\\/]/.test(process.argv[1] ?? "");

const LOCK = ".data/pglite.lock";

/**
 * PGlite supports one process at a time, and its own lock file holds a placeholder process id,
 * so it cannot tell two servers apart. This lock holds the real one: a second server (for example
 * `next start` while `next dev` runs) gets a clear error instead of damaging the database.
 * A lock left by a process that has ended is taken over.
 */
function claimLocalDatabase(): void {
  if (existsSync(LOCK)) {
    const holder = Number(readFileSync(LOCK, "utf8").trim());
    if (Number.isInteger(holder) && holder > 0 && holder !== process.pid && isRunning(holder)) {
      throw new Error(
        `The local database in .data/pglite is already open in another process (pid ${holder}). ` +
          "PGlite supports one process at a time: stop the other server first, or set DATABASE_URL.",
      );
    }
  }
  writeFileSync(LOCK, String(process.pid));
  process.once("exit", () => {
    try {
      if (readFileSync(LOCK, "utf8").trim() === String(process.pid)) unlinkSync(LOCK);
    } catch {
      // Already gone.
    }
  });
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

// Kept on globalThis so hot reloads in development reuse one connection.
const globalDb = globalThis as { __portfolioDb?: Promise<Driver> };

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (inHelperWorker && !process.env.DATABASE_URL) {
    throw new Error("The local database is not opened inside Next.js dev workers; only the main server opens it.");
  }
  globalDb.__portfolioDb ??= connect().catch((err) => {
    globalDb.__portfolioDb = undefined;
    throw err;
  });
  const driver = await globalDb.__portfolioDb;
  return (await driver.query(text, params)) as T[];
}

/**
 * True while `next build` runs with no DATABASE_URL. The build renders pages in several
 * processes at once, which the local file database cannot serve, so pages use the starter
 * content from content/ for that one case.
 */
export const useSeedContent = !process.env.DATABASE_URL && (process.env.NEXT_PHASE === "phase-production-build" || inHelperWorker);
