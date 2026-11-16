import type { AgentSettings, ItemType } from "./schemas";
import { AGENT_MODELS } from "./schemas";
import { isVideoAddress } from "./media";
import type { Article, Post, Profile, Project } from "./types";

// Describes each admin form as data: which fields it has, how a saved record fills them,
// and how a submitted form turns back into a record. Validation happens afterwards, in lib/schemas.ts.

export type Values = Record<string, string | boolean>;

export type Field = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "select" | "checkbox" | "number" | "image" | "media" | "swatches";
  help?: string;
  rows?: number;
  /** For swatches, `swatch` is the CSS class that paints the option. */
  options?: { value: string; label: string; swatch?: string }[];
  /** Only show this field while another field has one of these values. */
  showWhen?: { field: string; in: string[] };
  /** Shown but not editable once the record exists. */
  lockOnEdit?: boolean;
};

export type FormState = { n: number; ok?: boolean; message?: string; errors?: string[]; values?: Values };

/** URL segment in /admin/<segment> for each item type. */
export const SEGMENTS: Record<string, ItemType> = { projects: "project", articles: "article", content: "content" };
export const segmentFor = (type: ItemType) => ({ project: "projects", article: "articles", content: "content" })[type];
export const LABELS: Record<ItemType, { one: string; many: string }> = {
  project: { one: "project", many: "Projects" },
  article: { one: "article", many: "Articles" },
  content: { one: "content item", many: "Content" },
};

const lines = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);
const csv = (v: string) => v.split(",").map((l) => l.trim()).filter(Boolean);
const opt = (values: string[]) => values.map((value) => ({ value, label: value }));

const idField: Field = {
  name: "id",
  label: "Id",
  kind: "text",
  help: "Lowercase letters, numbers and hyphens. Used in links and by the agent. It cannot be changed later.",
  lockOnEdit: true,
};
const tagsField: Field = { name: "tags", label: "Search keywords", kind: "text", help: "Comma separated. These help the agent find this item." };
const featuredField: Field = { name: "featured", label: "Show on the About page", kind: "checkbox" };

const when = (...kinds: string[]) => ({ field: "preview_kind", in: kinds });
const BACKDROPS = ["sea", "cloud", "moss", "plum", "ember", "dusk"] as const;

const FIELDS: Record<ItemType, Field[]> = {
  project: [
    idField,
    { name: "title", label: "Title", kind: "text" },
    { name: "date", label: "Date", kind: "text", help: "Shown as written, for example Sep 2026." },
    { name: "status", label: "Status", kind: "select", options: [{ value: "completed", label: "Completed" }, { value: "in-progress", label: "In progress" }] },
    { name: "category", label: "Category", kind: "text", help: "Categories become the filter tabs on the Projects page." },
    { name: "description", label: "Card description", kind: "textarea", rows: 2 },
    {
      name: "details",
      label: "Full details",
      kind: "textarea",
      rows: 10,
      help: "Shown on the project's own page and read by the agent; not shown on the card. Supports **bold**, *italic*, links, - lists, and ## headings. Leave a blank line between paragraphs.",
    },
    {
      name: "media",
      label: "Pictures and videos",
      kind: "media",
      rows: 4,
      help: "Shown on the project's page, in this order. One per line as: address | caption (the caption is optional). Upload images below, or paste an https:// address. Videos can be YouTube or Vimeo links, or a direct .mp4, .webm or .mov file. One save takes about 4 MB of uploads in total, so add large images a few at a time.",
    },
    { name: "stack", label: "Stack", kind: "text", help: "Comma separated." },
    tagsField,
    { name: "live", label: "Live link", kind: "text", help: "Optional. Leave empty to hide the button." },
    { name: "github", label: "GitHub link", kind: "text", help: "Optional." },
    featuredField,
    {
      name: "preview_kind",
      label: "Card preview",
      kind: "select",
      options: [
        { value: "trace", label: "Agent steps" },
        { value: "search", label: "Search results" },
        { value: "bars", label: "Score chart" },
        { value: "voice", label: "Voice waveforms" },
        { value: "diff", label: "Prompt diff" },
        { value: "curve", label: "Training curve" },
        { value: "image", label: "Screenshot or GIF" },
      ],
    },
    { name: "pv_caption", label: "Preview caption", kind: "text", showWhen: when("trace", "bars", "diff", "curve") },
    { name: "pv_steps", label: "Steps", kind: "textarea", rows: 5, help: "One per line, up to 5.", showWhen: when("trace") },
    { name: "pv_query", label: "Search query", kind: "text", showWhen: when("search") },
    { name: "pv_results", label: "Results", kind: "textarea", rows: 3, help: "One per line as: label | score. Scores run from 0 to 1. Up to 3.", showWhen: when("search") },
    { name: "pv_values", label: "Bar values", kind: "text", help: "Comma separated, each 0 to 100. The last bar is drawn in red.", showWhen: when("bars") },
    { name: "pv_verdict", label: "Line under the chart", kind: "text", showWhen: when("bars") },
    { name: "pv_top", label: "Top label", kind: "text", showWhen: when("voice") },
    { name: "pv_bottom", label: "Bottom label", kind: "text", showWhen: when("voice") },
    { name: "pv_removed", label: "Removed line", kind: "text", showWhen: when("diff") },
    { name: "pv_added", label: "Added line", kind: "text", showWhen: when("diff") },
    { name: "pv_notes", label: "Notes", kind: "textarea", rows: 2, help: "One per line, up to 2.", showWhen: when("diff") },
    { name: "pv_note", label: "Line under the curve", kind: "text", showWhen: when("curve") },
    {
      name: "pv_src",
      label: "Screenshot or GIF",
      kind: "image",
      help: "Upload a PNG, JPEG, WebP or GIF (animated GIFs play on the card), or paste an https:// address. It sits in a rounded window on the backdrop below, cropped to fill it. A 16:10 image fits best. Uploads are limited to 4 MB.",
      showWhen: when("image"),
    },
    { name: "pv_alt", label: "Screenshot description", kind: "text", help: "Read aloud by screen readers.", showWhen: when("image") },
    { name: "window", label: "Preview window", kind: "select", options: opt(["dark", "light"]), showWhen: when("trace", "search", "bars", "voice", "diff", "curve") },
    {
      name: "backdrop",
      label: "Background gradient",
      kind: "swatches",
      help: "The gradient behind the card's preview.",
      options: BACKDROPS.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1), swatch: `scene-${value}` })),
    },
  ],
  article: [
    idField,
    { name: "title", label: "Title", kind: "text" },
    { name: "date", label: "Date", kind: "text", help: "Shown as written, for example Oct 2026." },
    { name: "readingTime", label: "Reading time", kind: "text", help: "For example 9 min." },
    { name: "summary", label: "Summary", kind: "textarea", rows: 3, help: "Shown under the title and read by the agent." },
    { name: "url", label: "Link", kind: "text", help: "Where the article lives." },
    tagsField,
    featuredField,
  ],
  content: [
    idField,
    { name: "kind", label: "Type", kind: "text", help: "For example Video, Talk, Thread." },
    { name: "title", label: "Title", kind: "text" },
    {
      name: "platform",
      label: "Platform",
      kind: "text",
      help: "Where it was published, for example YouTube, X, LinkedIn, Substack or Meetup. Picks the icon and the thumbnail colour.",
    },
    { name: "meta", label: "Length", kind: "text", help: "For example 21 min, 9 posts or Monthly. Shown on the thumbnail." },
    { name: "date", label: "Date", kind: "text", help: "Optional. Shown as written, for example Sep 2026." },
    { name: "summary", label: "Summary", kind: "textarea", rows: 3, help: "Shown on the card." },
    {
      name: "details",
      label: "Details",
      kind: "textarea",
      rows: 6,
      help: "Optional. Shown in the popup when someone opens the card, and read by the agent. Supports **bold**, *italic*, links and - lists.",
    },
    {
      name: "thumbnail",
      label: "Thumbnail",
      kind: "image",
      help: "Optional. Upload an image (16:9 works best), or paste an https:// address. Without one, a thumbnail is drawn from the title.",
    },
    { name: "url", label: "Link", kind: "text" },
    tagsField,
    featuredField,
  ],
};

export const itemFields = (type: ItemType) => FIELDS[type];

const BLANK: Record<ItemType, Values> = {
  project: { status: "completed", preview_kind: "trace", window: "dark", backdrop: "sea", featured: false },
  article: { featured: false },
  content: { featured: false },
};

export function itemToValues(type: ItemType, item: unknown | null): Values {
  if (!item) return { ...BLANK[type] };
  if (type === "article") {
    const a = item as Article;
    return { ...a, tags: a.tags.join(", "), featured: Boolean(a.featured) };
  }
  if (type === "content") {
    const c = item as Post;
    return {
      ...c,
      platform: c.platform ?? "",
      date: c.date ?? "",
      details: c.details ?? "",
      thumbnail: c.thumbnail ?? "",
      tags: c.tags.join(", "),
      featured: Boolean(c.featured),
    };
  }
  const p = item as Project;
  const v: Values = {
    id: p.id,
    title: p.title,
    date: p.date,
    status: p.status,
    category: p.category,
    description: p.description,
    details: p.details,
    media: (p.media ?? []).map((m) => (m.caption ? `${m.src} | ${m.caption}` : m.src)).join("\n"),
    stack: p.stack.join(", "),
    tags: p.tags.join(", "),
    live: p.links.live ?? "",
    github: p.links.github ?? "",
    featured: Boolean(p.featured),
    window: p.window,
    backdrop: p.backdrop,
    preview_kind: p.preview.kind,
  };
  const pv = p.preview;
  if (pv.kind === "trace") Object.assign(v, { pv_caption: pv.caption, pv_steps: pv.steps.join("\n") });
  if (pv.kind === "search") Object.assign(v, { pv_query: pv.query, pv_results: pv.results.map((r) => `${r.label} | ${r.score}`).join("\n") });
  if (pv.kind === "bars") Object.assign(v, { pv_caption: pv.caption, pv_values: pv.values.join(", "), pv_verdict: pv.verdict });
  if (pv.kind === "voice") Object.assign(v, { pv_top: pv.top, pv_bottom: pv.bottom });
  if (pv.kind === "diff") Object.assign(v, { pv_caption: pv.caption, pv_removed: pv.removed, pv_added: pv.added, pv_notes: pv.notes.join("\n") });
  if (pv.kind === "curve") Object.assign(v, { pv_caption: pv.caption, pv_note: pv.note });
  if (pv.kind === "image") Object.assign(v, { pv_src: pv.src, pv_alt: pv.alt });
  return v;
}

/** Reads the submitted fields back as plain values, so a rejected form can be shown again as typed. */
export function readValues(fields: Field[], form: FormData): Values {
  const values: Values = {};
  for (const field of fields) {
    const raw = form.get(field.name);
    values[field.name] = field.kind === "checkbox" ? raw === "on" : typeof raw === "string" ? raw : "";
  }
  return values;
}

/** Turns submitted values into a record shaped like the schema expects. Not yet validated. */
export function valuesToItem(type: ItemType, v: Values): unknown {
  const s = (name: string) => String(v[name] ?? "").trim();
  const base = { id: s("id"), title: s("title"), tags: csv(s("tags")), featured: v.featured === true };
  if (type === "article") return { ...base, date: s("date"), readingTime: s("readingTime"), summary: s("summary"), url: s("url") };
  if (type === "content") {
    const optional = (name: string) => s(name) || undefined;
    return {
      ...base,
      kind: s("kind"),
      platform: optional("platform"),
      date: optional("date"),
      meta: s("meta"),
      summary: s("summary"),
      details: optional("details"),
      thumbnail: optional("thumbnail"),
      url: s("url"),
    };
  }

  const kind = s("preview_kind");
  const preview =
    kind === "trace" ? { kind, caption: s("pv_caption"), steps: lines(s("pv_steps")) }
    : kind === "search" ? {
        kind,
        query: s("pv_query"),
        results: lines(s("pv_results")).map((line) => {
          const [label, score] = line.split("|");
          return { label: (label ?? "").trim(), score: Number(score) };
        }),
      }
    : kind === "bars" ? { kind, caption: s("pv_caption"), values: csv(s("pv_values")).map(Number), verdict: s("pv_verdict") }
    : kind === "voice" ? { kind, top: s("pv_top"), bottom: s("pv_bottom") }
    : kind === "diff" ? { kind, caption: s("pv_caption"), removed: s("pv_removed"), added: s("pv_added"), notes: lines(s("pv_notes")) }
    : kind === "curve" ? { kind, caption: s("pv_caption"), note: s("pv_note") }
    : { kind, src: s("pv_src"), alt: s("pv_alt") };

  return {
    ...base,
    date: s("date"),
    status: s("status"),
    category: s("category"),
    description: s("description"),
    details: s("details"),
    media: lines(s("media")).map((line) => {
      const [src, ...rest] = line.split("|");
      const address = (src ?? "").trim();
      const caption = rest.join("|").trim();
      return { kind: isVideoAddress(address) ? "video" : "image", src: address, ...(caption ? { caption } : {}) };
    }),
    stack: csv(s("stack")),
    links: { live: s("live") || undefined, github: s("github") || undefined },
    preview,
    window: s("window") || "dark",
    backdrop: s("backdrop"),
  };
}

// ---------- Profile ----------

export const profileFields: Field[] = [
  { name: "name", label: "Name", kind: "text" },
  { name: "tagline", label: "Tagline", kind: "text" },
  { name: "intro", label: "Intro", kind: "textarea", rows: 8, help: "Shown at the top of the About page. Leave a blank line between paragraphs." },
  { name: "background", label: "Background for the agent", kind: "textarea", rows: 4, help: "The agent uses this when someone asks who you are." },
  { name: "focus", label: "What I can help with", kind: "textarea", rows: 4, help: "One per line." },
  { name: "availability", label: "Availability", kind: "text" },
  { name: "email", label: "Email", kind: "text" },
  { name: "links", label: "Social links", kind: "textarea", rows: 4, help: "One per line as: Label | https://address. GitHub, LinkedIn and X get their logos." },
];

export function profileToValues(p: Profile): Values {
  return {
    name: p.name,
    tagline: p.tagline,
    intro: p.intro.join("\n\n"),
    background: p.background,
    focus: p.focus.join("\n"),
    availability: p.availability,
    email: p.email,
    links: p.links.map((l) => `${l.label} | ${l.url}`).join("\n"),
  };
}

export function valuesToProfile(v: Values): unknown {
  const s = (name: string) => String(v[name] ?? "").trim();
  return {
    name: s("name"),
    tagline: s("tagline"),
    intro: s("intro").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    background: s("background"),
    focus: lines(s("focus")),
    availability: s("availability"),
    email: s("email"),
    links: lines(s("links")).map((line) => {
      const [label, ...rest] = line.split("|");
      return { label: (label ?? "").trim(), url: rest.join("|").trim() };
    }),
  };
}

// ---------- Agent settings ----------

export const agentFields: Field[] = [
  { name: "enabled", label: "Agent is on", kind: "checkbox", help: "When off, the home page shows the chat as unavailable and visitors use the browse pages." },
  {
    name: "guardEnabled",
    label: "Screen questions first",
    kind: "checkbox",
    help: "A small, fast model checks each question is about you or your work before the main model runs. Off-topic questions get a short redirect and cost almost nothing.",
  },
  {
    name: "model",
    label: "Model",
    kind: "select",
    options: AGENT_MODELS.map((value) => ({ value, label: value })),
    help: "Opus is the default. Sonnet and Haiku cost less; Fable costs more.",
  },
  { name: "effort", label: "Effort", kind: "select", options: opt(["low", "medium", "high"]), help: "Higher effort thinks longer and costs more. Low suits short answers." },
  { name: "maxTokens", label: "Answer length limit (tokens)", kind: "number", help: "Between 500 and 8000." },
  { name: "suggestions", label: "Suggested questions", kind: "textarea", rows: 5, help: "One per line, up to 6. Shown under the input on the home page." },
  {
    name: "extraInstructions",
    label: "Extra instructions",
    kind: "textarea",
    rows: 6,
    help: "Tone and emphasis for the agent, in your own words. The core rules (answer only from site content, stay on topic) always apply and cannot be changed here.",
  },
  { name: "rateLimitMax", label: "Questions allowed per visitor", kind: "number" },
  { name: "rateLimitWindowMinutes", label: "Within this many minutes", kind: "number" },
];

export function agentToValues(a: AgentSettings): Values {
  return {
    enabled: a.enabled,
    guardEnabled: a.guardEnabled,
    model: a.model,
    effort: a.effort,
    maxTokens: String(a.maxTokens),
    suggestions: a.suggestions.join("\n"),
    extraInstructions: a.extraInstructions,
    rateLimitMax: String(a.rateLimitMax),
    rateLimitWindowMinutes: String(a.rateLimitWindowMinutes),
  };
}

export function valuesToAgent(v: Values): unknown {
  const s = (name: string) => String(v[name] ?? "").trim();
  return {
    enabled: v.enabled === true,
    guardEnabled: v.guardEnabled === true,
    model: s("model"),
    effort: s("effort"),
    maxTokens: Number(s("maxTokens")),
    suggestions: lines(s("suggestions")),
    extraInstructions: s("extraInstructions"),
    rateLimitMax: Number(s("rateLimitMax")),
    rateLimitWindowMinutes: Number(s("rateLimitWindowMinutes")),
  };
}
