import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { articles as seedArticles } from "@/content/articles";
import { posts as seedPosts } from "@/content/posts";
import { profile as seedProfile } from "@/content/profile";
import { projects as seedProjects } from "@/content/projects";
import { query, useSeedContent } from "./db";
import {
  agentSettingsSchema,
  articleSchema,
  defaultAgentSettings,
  itemSchemas,
  postSchema,
  profileSchema,
  projectSchema,
  type AgentSettings,
  type ItemType,
} from "./schemas";
import { articleItem, postItem, projectItem } from "./content";
import type { Article, Item, Post, Profile, Project } from "./types";

/** Cache tag for everything the public pages read. Admin saves expire it. */
export const CONTENT_TAG = "content";

// ---------- Reads (uncached: used by the admin and by the cached wrappers below) ----------

async function readItems(type: ItemType): Promise<unknown[]> {
  if (useSeedContent) return { project: seedProjects, article: seedArticles, content: seedPosts }[type];
  const rows = await query<{ data: unknown }>(`SELECT data FROM items WHERE type = $1 ORDER BY position, id`, [type]);
  return rows.map((r) => r.data);
}

/** Parses rows and drops any that no longer match the schema, so one bad row cannot break a page. */
function valid<T>(rows: unknown[], schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T[] {
  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data as T] : [];
  });
}

export const readProjects = async (): Promise<Project[]> => valid<Project>(await readItems("project"), projectSchema);
export const readArticles = async (): Promise<Article[]> => valid<Article>(await readItems("article"), articleSchema);
export const readPosts = async (): Promise<Post[]> => valid<Post>(await readItems("content"), postSchema);

async function readSetting(key: string): Promise<unknown> {
  const rows = await query<{ value: unknown }>(`SELECT value FROM settings WHERE key = $1`, [key]);
  return rows[0]?.value;
}

export async function readProfile(): Promise<Profile> {
  if (useSeedContent) return seedProfile;
  const parsed = profileSchema.safeParse(await readSetting("profile"));
  return parsed.success ? parsed.data : seedProfile;
}

export async function readAgentSettings(): Promise<AgentSettings> {
  if (useSeedContent) return defaultAgentSettings;
  const parsed = agentSettingsSchema.safeParse(await readSetting("agent"));
  return parsed.success ? parsed.data : defaultAgentSettings;
}

export async function readItem(type: ItemType, id: string): Promise<unknown | null> {
  const rows = await query<{ data: unknown }>(`SELECT data FROM items WHERE type = $1 AND id = $2`, [type, id]);
  const parsed = rows[0] ? itemSchemas[type].safeParse(rows[0].data) : null;
  return parsed?.success ? parsed.data : null;
}

// ---------- Cached reads for the public pages and the agent ----------

export async function getProjects(): Promise<Project[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  return readProjects();
}

export async function getArticles(): Promise<Article[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  return readArticles();
}

export async function getPosts(): Promise<Post[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  return readPosts();
}

export async function getProfile(): Promise<Profile> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  return readProfile();
}

export async function getAgentSettings(): Promise<AgentSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  return readAgentSettings();
}

// ---------- Full-text search (used by the agent) ----------

/** Words a visitor might use that say nothing about the topic. Postgres drops common English words itself. */
const FILLER = new Set(["built", "build", "made", "make", "work", "worked", "written", "write", "show", "tell", "anything", "something"]);

/**
 * Searches projects, articles and content with Postgres full-text search and returns the best matches first.
 * Any word may match; items matching more of the words rank higher.
 */
export async function searchContent(text: string, limit = 5): Promise<Item[]> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FILLER.has(w))
    .slice(0, 12);
  if (!words.length) return [];

  const document = `to_tsvector('english',
    coalesce(data->>'title','') || ' ' || coalesce(data->>'description','') || ' ' || coalesce(data->>'summary','') || ' ' ||
    coalesce(data->>'details','') || ' ' || coalesce(data->>'category','') || ' ' || coalesce(data->>'kind','') || ' ' ||
    coalesce(data->>'tags','') || ' ' || coalesce(data->>'stack',''))`;
  // The words are reduced to letters and digits above, so joining them with "|" is a safe OR query.
  const rows = await query<{ type: ItemType; data: unknown }>(
    `SELECT type, data FROM items
     WHERE ${document} @@ to_tsquery('english', $1)
     ORDER BY ts_rank(${document}, to_tsquery('english', $1)) DESC, position
     LIMIT $2`,
    [words.join(" | "), limit],
  );

  return rows.flatMap((row) => {
    const parsed = itemSchemas[row.type]?.safeParse(row.data);
    if (!parsed?.success) return [];
    if (row.type === "project") return [projectItem(parsed.data as Project)];
    if (row.type === "article") return [articleItem(parsed.data as Article)];
    return [postItem(parsed.data as Post)];
  });
}

// ---------- Writes (callers must have checked the admin session and validated the data) ----------

export async function idExists(id: string): Promise<boolean> {
  return (await query(`SELECT 1 FROM items WHERE id = $1`, [id])).length > 0;
}

export async function insertItem(type: ItemType, id: string, data: unknown): Promise<void> {
  // New items go to the top of their list.
  await query(`UPDATE items SET position = position + 1 WHERE type = $1`, [type]);
  await query(`INSERT INTO items (id, type, position, data) VALUES ($1, $2, 0, $3::jsonb)`, [id, type, JSON.stringify(data)]);
}

export async function updateItem(type: ItemType, id: string, data: unknown): Promise<boolean> {
  const rows = await query(`UPDATE items SET data = $3::jsonb, updated_at = now() WHERE type = $1 AND id = $2 RETURNING id`, [
    type,
    id,
    JSON.stringify(data),
  ]);
  return rows.length > 0;
}

export async function deleteItem(type: ItemType, id: string): Promise<boolean> {
  return (await query(`DELETE FROM items WHERE type = $1 AND id = $2 RETURNING id`, [type, id])).length > 0;
}

/** Moves an item one place up or down within its list. */
export async function moveItem(type: ItemType, id: string, direction: "up" | "down"): Promise<void> {
  const rows = await query<{ id: string }>(`SELECT id FROM items WHERE type = $1 ORDER BY position, id`, [type]);
  const ids = rows.map((r) => r.id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  for (const [position, itemId] of ids.entries()) {
    await query(`UPDATE items SET position = $1 WHERE id = $2 AND position <> $1`, [position, itemId]);
  }
}

export async function saveSetting(key: "profile" | "agent", value: unknown): Promise<void> {
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

// ---------- Activity log ----------

export async function logActivity(action: string, detail = ""): Promise<void> {
  await query(`INSERT INTO audit (action, detail) VALUES ($1, $2)`, [action.slice(0, 80), detail.slice(0, 300)]);
}

export async function recentActivity(limit = 40): Promise<{ at: string; action: string; detail: string }[]> {
  const rows = await query<{ at: Date | string; action: string; detail: string }>(
    `SELECT at, action, detail FROM audit ORDER BY id DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({ at: new Date(r.at).toISOString(), action: r.action, detail: r.detail }));
}

// ---------- Rate limiting (shared across server instances because it lives in the database) ----------

/** Counts events in a bucket within the last `windowMinutes`. */
export async function countAttempts(bucket: string, windowMinutes: number): Promise<number> {
  const rows = await query<{ n: number | string }>(
    `SELECT count(*) AS n FROM attempts WHERE bucket = $1 AND at > now() - ($2 * interval '1 minute')`,
    [bucket, windowMinutes],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function recordAttempt(bucket: string): Promise<void> {
  await query(`INSERT INTO attempts (bucket) VALUES ($1)`, [bucket]);
  // Occasional tidy-up so the table stays small.
  if (Math.random() < 0.02) await query(`DELETE FROM attempts WHERE at < now() - interval '2 days'`);
}
