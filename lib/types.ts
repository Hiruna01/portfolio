export type Preview =
  | { kind: "trace"; caption: string; steps: string[] }
  | { kind: "search"; query: string; results: { label: string; score: number }[] }
  | { kind: "bars"; caption: string; values: number[]; verdict: string }
  | { kind: "voice"; top: string; bottom: string }
  | { kind: "diff"; caption: string; removed: string; added: string; notes: string[] }
  | { kind: "curve"; caption: string; note: string }
  | { kind: "image"; src: string; alt: string };

export type ProjectMedia = { kind: "image" | "video"; src: string; caption?: string };

export type Backdrop = "sea" | "cloud" | "moss" | "plum" | "ember" | "dusk";

export type Project = {
  id: string;
  title: string;
  date: string;
  status: "completed" | "in-progress";
  category: string;
  description: string;
  /** The full write-up, in limited Markdown. Shown on the project's own page and read by the agent; not shown on cards. */
  details: string;
  /** Pictures and videos for the project's page. */
  media?: ProjectMedia[];
  stack: string[];
  tags: string[];
  links: { live?: string; github?: string };
  preview: Preview;
  /** Window style for animated previews. Ignored for image previews. */
  window: "dark" | "light";
  backdrop: Backdrop;
  featured?: boolean;
};

export type Article = {
  id: string;
  title: string;
  date: string;
  readingTime: string;
  summary: string;
  url: string;
  tags: string[];
  featured?: boolean;
};

export type Post = {
  id: string;
  kind: string;
  title: string;
  platform?: string;
  date?: string;
  meta: string;
  summary: string;
  details?: string;
  thumbnail?: string;
  url: string;
  tags: string[];
  featured?: boolean;
};

export type Profile = {
  name: string;
  /** Unused since the avatar was removed; older profiles may still carry them. */
  initials?: string;
  photo?: string;
  tagline: string;
  intro: string[];
  background: string;
  focus: string[];
  availability: string;
  email: string;
  links: { label: string; url: string }[];
};

/** One searchable thing on the site, as the agent and the chat UI see it. */
export type Item = {
  type: "project" | "article" | "content";
  kind: string;
  id: string;
  title: string;
  summary: string;
  href: string;
};

/** Something the agent chose to show under its answer. The server fills these from the database. */
export type UiBlock =
  | { kind: "projects"; items: Project[] }
  | { kind: "articles"; items: Article[] }
  | { kind: "content"; items: Post[] }
  | { kind: "contact"; email: string; availability: string; links: { label: string; url: string }[] };

export type ChatEvent =
  | { t: "step"; label: string }
  | { t: "ui"; block: UiBlock }
  | { t: "followups"; questions: string[] }
  | { t: "text"; d: string }
  | { t: "clear" }
  | { t: "sources"; items: Item[] }
  | { t: "demo" }
  | { t: "error"; message: string }
  | { t: "done" };

/** The answer modes a visitor can pick in the prompt bar: Hiru Flash, Hiru Core and Hiru Reason. */
