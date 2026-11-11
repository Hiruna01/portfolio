import { z } from "zod";

// Validation for everything the admin can save. The server runs these on every write,
// and again on every read, so a malformed row can never reach a page or the agent.

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max);

/** Links may point at a site page ("/x"), an anchor ("#"), or an http(s) address. Nothing else. */
const link = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "#" || /^\/(?!\/)/.test(v) || /^https?:\/\/[^\s]+$/i.test(v), "Use a full https:// address or a path starting with /");

const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
  .max(60);

const tags = z.array(text(40)).max(20);

export const previewSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("trace"), caption: text(60), steps: z.array(text(60)).min(1).max(5) }),
  z.object({
    kind: z.literal("search"),
    query: text(80),
    results: z.array(z.object({ label: text(60), score: z.number().min(0).max(1) })).min(1).max(3),
  }),
  z.object({ kind: z.literal("bars"), caption: text(60), values: z.array(z.number().min(0).max(100)).min(2).max(12), verdict: text(60) }),
  z.object({ kind: z.literal("voice"), top: text(30), bottom: text(30) }),
  z.object({ kind: z.literal("diff"), caption: text(60), removed: text(80), added: text(80), notes: z.array(text(60)).max(2) }),
  z.object({ kind: z.literal("curve"), caption: text(60), note: text(60) }),
  z.object({ kind: z.literal("image"), src: link, alt: optionalText(160) }),
]);

/** A picture or video on a project's page. Videos are YouTube or Vimeo links, or a direct .mp4, .webm or .mov file. */
export const mediaSchema = z.object({
  kind: z.enum(["image", "video"]),
  src: link.refine((v) => v !== "#", "Give the image or video address"),
  caption: optionalText(160).optional(),
});

export const projectSchema = z.object({
  id: slug,
  title: text(80),
  date: text(30),
  status: z.enum(["completed", "in-progress"]),
  category: text(40),
  description: text(240),
  details: optionalText(6000),
  /** Pictures and videos shown on the project's page, in order. */
  media: z.array(mediaSchema).max(12).optional(),
  stack: z.array(text(40)).max(12),
  tags,
  links: z.object({ live: link.optional(), github: link.optional() }),
  preview: previewSchema,
  window: z.enum(["dark", "light"]),
  backdrop: z.enum(["sea", "cloud", "moss", "plum", "ember", "dusk"]),
  featured: z.boolean().optional(),
});

export const articleSchema = z.object({
  id: slug,
  title: text(140),
  date: text(30),
  readingTime: text(20),
  summary: text(400),
  url: link,
  tags,
  featured: z.boolean().optional(),
});

export const postSchema = z.object({
  id: slug,
  kind: text(30),
  title: text(140),
  /** Where it was published, for example YouTube. Picks the icon and the thumbnail tint. */
  platform: optionalText(30).optional(),
  date: optionalText(30).optional(),
  /** Length or size, for example 21 min or 9 posts. Older posts also start with the platform ("YouTube, 21 min"). */
  meta: text(60),
  summary: text(400),
  /** Longer description shown in the detail popup and read by the agent. Limited Markdown. */
  details: optionalText(3000).optional(),
  thumbnail: link.optional(),
  url: link,
  tags,
  featured: z.boolean().optional(),
});

export const profileSchema = z.object({
  name: text(80),
  /** Older profiles saved initials and a photo for an avatar that is no longer shown. Kept readable, never required. */
  initials: optionalText(3).optional(),
  photo: link.optional(),
  tagline: text(120),
  intro: z.array(text(700)).min(1).max(6),
  background: text(1500),
  focus: z.array(text(120)).max(8),
  availability: text(240),
  email: z.email().max(160),
  links: z.array(z.object({ label: text(30), url: link })).max(8),
});

/** Models the admin may pick. Anything else is rejected, so a typo cannot break the agent. */
export const AGENT_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"] as const;

export const agentSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Screens each question with a small, fast model before the main model sees it. */
  guardEnabled: z.boolean().default(true),
  model: z.enum(AGENT_MODELS),
  effort: z.enum(["low", "medium", "high"]),
  maxTokens: z.number().int().min(500).max(8000),
  suggestions: z.array(text(80)).max(6),
  extraInstructions: optionalText(2000),
  rateLimitMax: z.number().int().min(1).max(200),
  rateLimitWindowMinutes: z.number().int().min(1).max(1440),
});

export type AgentSettings = z.infer<typeof agentSettingsSchema>;

export const defaultAgentSettings: AgentSettings = {
  enabled: true,
  guardEnabled: true,
  model: "claude-opus-5-5",
  effort: "low",
  maxTokens: 4000,
  suggestions: ["What have you built with agents?", "How do you approach evals?", "Anything on retrieval?", "How can I reach you?"],
  extraInstructions: "",
  rateLimitMax: 20,
  rateLimitWindowMinutes: 10,
};

export const itemSchemas = { project: projectSchema, article: articleSchema, content: postSchema } as const;
export type ItemType = keyof typeof itemSchemas;
