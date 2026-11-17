"use server";

import Anthropic from "@anthropic-ai/sdk";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import {
  agentFields,
  itemFields,
  LABELS,
  profileFields,
  readValues,
  segmentFor,
  valuesToAgent,
  valuesToItem,
  valuesToProfile,
  type FormState,
  type Values,
} from "@/lib/admin-forms";
import { clientIp, logIn, logOut, requireAdmin } from "@/lib/auth";
import { agentSettingsSchema, itemSchemas, profileSchema, type ItemType } from "@/lib/schemas";
import { draftProject, DraftError } from "@/lib/drafter";
import { GitHubError } from "@/lib/drafter/github";
import {
  CONTENT_TAG,
  countAttempts,
  deleteItem,
  getProjects,
  idExists,
  insertItem,
  logActivity,
  moveItem,
  readAgentSettings,
  readItem,
  recordAttempt,
  saveSetting,
  updateItem,
} from "@/lib/store";
import type { Project } from "@/lib/types";
import { storeImage, UploadError } from "@/lib/uploads";

// Every action here is a public HTTP endpoint. Each one checks the admin session itself
// (never relying on the page having checked) and validates everything it is sent.

function asType(value: string): ItemType {
  if (value !== "project" && value !== "article" && value !== "content") throw new Error("Unknown item type");
  return value;
}

function problems(error: z.ZodError, labels: Record<string, string>): string[] {
  return error.issues.slice(0, 8).map((issue) => {
    const key = String(issue.path[0] ?? "");
    return `${labels[key] ?? key}: ${issue.message}`;
  });
}

/** Replaces a field's value with the address of a freshly uploaded image, when one was attached. */
async function applyUpload(form: FormData, values: Values, field: string): Promise<void> {
  const file = form.get(`${field}_file`);
  if (file instanceof File && file.size > 0) values[field] = await storeImage(file);
}

/** Uploads every image attached to a media list and adds each one's address as a new line. */
async function applyMediaUploads(form: FormData, values: Values, field: string): Promise<void> {
  const files = form.getAll(`${field}_files`).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 12) throw new UploadError("Upload at most 12 images at a time.");
  const added: string[] = [];
  for (const file of files) added.push(await storeImage(file));
  if (added.length) values[field] = [String(values[field] ?? "").trim(), ...added].filter(Boolean).join("\n");
}

// ---------- Session ----------

export async function loginAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const username = String(form.get("username") ?? "").slice(0, 100);
  const password = String(form.get("password") ?? "").slice(0, 200);
  const result = await logIn(username, password);
  if (result === "ok") {
    await logActivity("Signed in");
    redirect("/admin");
  }
  if (result === "locked") return { error: "Too many failed attempts. Wait 15 minutes and try again." };
  if (result === "not-configured") return { error: "Admin login is not set up on this server yet." };
  await logActivity("Failed sign-in", `from ${await clientIp()}`);
  return { error: "That username or password is not right." };
}

export async function logoutAction(): Promise<void> {
  await logOut();
  redirect("/admin/login");
}

export async function logoutEverywhereAction(): Promise<void> {
  await requireAdmin();
  await logOut(true);
  redirect("/admin/login");
}

// ---------- Projects, articles, content ----------

export async function saveItemAction(typeArg: string, originalId: string | null, prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const type = asType(typeArg);
  const fields = itemFields(type);
  const values = readValues(fields, form);
  if (originalId) values.id = originalId; // the id of an existing item never changes
  const fail = (errors: string[]): FormState => ({ n: prev.n + 1, errors, values });

  try {
    if (type === "project" && values.preview_kind === "image") await applyUpload(form, values, "pv_src");
    if (type === "project") await applyMediaUploads(form, values, "media");
    if (type === "content") await applyUpload(form, values, "thumbnail");
  } catch (err) {
    if (err instanceof UploadError) return fail([err.message]);
    throw err;
  }

  const parsed = itemSchemas[type].safeParse(valuesToItem(type, values));
  if (!parsed.success) {
    const labels: Record<string, string> = Object.fromEntries(fields.map((f) => [f.name, f.label]));
    return fail(problems(parsed.error, { ...labels, links: "Links", preview: "Card preview", readingTime: "Reading time", media: "Pictures and videos" }));
  }

  if (originalId) {
    if (!(await updateItem(type, originalId, parsed.data))) return fail(["That item no longer exists."]);
    await logActivity(`Edited ${LABELS[type].one}`, parsed.data.title);
  } else {
    if (await idExists(parsed.data.id)) return fail(["Id: that id is already used. Ids are shared across projects, articles and content."]);
    await insertItem(type, parsed.data.id, parsed.data);
    await logActivity(`Added ${LABELS[type].one}`, parsed.data.title);
  }

  updateTag(CONTENT_TAG);
  redirect(`/admin/${segmentFor(type)}`);
}

export async function deleteItemAction(typeArg: string, id: string): Promise<void> {
  await requireAdmin();
  const type = asType(typeArg);
  if (await deleteItem(type, String(id).slice(0, 80))) {
    await logActivity(`Deleted ${LABELS[type].one}`, id);
    updateTag(CONTENT_TAG);
  }
  redirect(`/admin/${segmentFor(type)}`);
}

export async function moveItemAction(typeArg: string, id: string, direction: string): Promise<void> {
  await requireAdmin();
  const type = asType(typeArg);
  await moveItem(type, String(id).slice(0, 80), direction === "up" ? "up" : "down");
  updateTag(CONTENT_TAG);
  redirect(`/admin/${segmentFor(type)}`);
}

// ---------- Drafting a project from GitHub ----------

export type DraftState = {
  n: number;
  /** Counts successful drafts only; the form below remounts with new values when it changes. */
  drafts?: number;
  error?: string;
  values?: Values;
  filled?: string[];
  notes?: string[];
  repo?: string;
};

/** Drafts allowed per hour. Each one costs a model call, so a stolen session cannot run up the bill. */
const DRAFTS_PER_HOUR = 20;

/**
 * Reads a public GitHub repository's README and returns a filled-in project form for the admin to review.
 * It saves nothing: the admin checks the fields and saves with the form's own button.
 */
export async function draftProjectAction(prev: DraftState, form: FormData): Promise<DraftState> {
  await requireAdmin();
  const n = prev.n + 1;
  // A failed attempt keeps the previous draft, so the form below is not cleared.
  const kept = { drafts: prev.drafts, values: prev.values, filled: prev.filled };
  const url = String(form.get("repo") ?? "").slice(0, 300).trim();
  if (!url) return { ...kept, n, error: "Paste a GitHub repository link first.", repo: url };
  // Set when refreshing a saved project from its README; empty when drafting a new one.
  const projectId = String(form.get("projectId") ?? "").slice(0, 80);

  if ((await countAttempts("draft", 60)) >= DRAFTS_PER_HOUR) {
    return { ...kept, n, error: `That is ${DRAFTS_PER_HOUR} drafts this hour. Try again later.`, repo: url };
  }
  await recordAttempt("draft");

  try {
    const [settings, projects, saved] = await Promise.all([
      readAgentSettings(),
      getProjects(),
      projectId ? readItem("project", projectId) : Promise.resolve(null),
    ]);
    if (projectId && !saved) return { ...kept, n, error: "That project no longer exists.", repo: url };
    const current = saved ? (saved as Project) : undefined;
    const categories = [...new Set(projects.map((p) => p.category))];
    const draft = await draftProject({ url, categories, isTaken: idExists, settings, current });
    await logActivity(current ? "Refreshed project from GitHub" : "Drafted project from GitHub", current ? `${current.title}: ${url}` : url);
    return { n, drafts: (prev.drafts ?? 0) + 1, values: draft.values, filled: draft.filled, notes: draft.notes, repo: url };
  } catch (err) {
    if (err instanceof GitHubError || err instanceof DraftError) return { ...kept, n, error: err.message, repo: url };
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return { ...kept, n, error: "The Claude API key was not accepted. Check ANTHROPIC_API_KEY on the server.", repo: url };
    }
    if (err instanceof Anthropic.RateLimitError) return { ...kept, n, error: "The Claude API is busy. Try again in a minute.", repo: url };
    if (err instanceof Anthropic.APIError) return { ...kept, n, error: `The Claude API returned an error (${err.status ?? "no status"}). Try again.`, repo: url };
    console.error("Project draft failed", err);
    return { ...kept, n, error: "Something went wrong drafting that project. Try again.", repo: url };
  }
}

// ---------- Profile and agent settings ----------

export async function saveProfileAction(prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const values = readValues(profileFields, form);
  const fail = (errors: string[]): FormState => ({ n: prev.n + 1, errors, values });

  const parsed = profileSchema.safeParse(valuesToProfile(values));
  if (!parsed.success) return fail(problems(parsed.error, Object.fromEntries(profileFields.map((f) => [f.name, f.label]))));

  await saveSetting("profile", parsed.data);
  await logActivity("Edited profile");
  updateTag(CONTENT_TAG);
  return { n: prev.n + 1, ok: true, message: "Profile saved.", values };
}

export async function saveAgentAction(prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const values = readValues(agentFields, form);
  const parsed = agentSettingsSchema.safeParse(valuesToAgent(values));
  if (!parsed.success) {
    return { n: prev.n + 1, errors: problems(parsed.error, Object.fromEntries(agentFields.map((f) => [f.name, f.label]))), values };
  }
  await saveSetting("agent", parsed.data);
  await logActivity("Edited agent settings", `${parsed.data.enabled ? "on" : "off"}, ${parsed.data.model}`);
  updateTag(CONTENT_TAG);
  return { n: prev.n + 1, ok: true, message: "Agent settings saved.", values };
}
