import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { articleItem, postItem, postWhere, projectItem } from "../content";
import { getArticles, getPosts, getProfile, getProjects, searchContent } from "../store";
import type { ChatEvent, Item } from "../types";

// The agent's tools. All of them only read saved site content.
//   - Data tools fetch records from the database for the model to read.
//   - Display tools take ids, look the records up again on the server, and send them to the
//     page as cards. The model never supplies a card's contents, so it cannot invent one.

export type ToolRun = {
  /** Sends an event to the visitor's browser. */
  emit: (event: ChatEvent) => void;
  /** Items the agent read, for the source chips under the answer. */
  read: Item[];
  /** Ids already shown as cards, so they are not repeated as source chips. */
  shown: Set<string>;
};

const json = (value: unknown) => JSON.stringify(value);
const ids = (max: number) => z.array(z.string().max(80)).min(1).max(max).describe("Item ids, exactly as returned by the data tools");

export function createTools(run: ToolRun) {
  const step = (label: string) => run.emit({ t: "step", label });
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  // ---------- Data tools ----------

  const listProjects = tool(
    async ({ category, status, featured_only }) => {
      let projects = await getProjects();
      if (category) projects = projects.filter((p) => p.category.toLowerCase() === category.toLowerCase());
      if (status) projects = projects.filter((p) => p.status === status);
      if (featured_only) projects = projects.filter((p) => p.featured);
      step(`listed projects, ${count(projects.length, "result", "results")}`);
      return json(
        projects.map((p) => ({ id: p.id, title: p.title, date: p.date, status: p.status, category: p.category, description: p.description, stack: p.stack })),
      );
    },
    {
      name: "list_projects",
      description:
        "List my projects, newest first, with id, title, date, status, category, short description and stack. Optional filters narrow the list. Call get_project for the full write-up of one project.",
      schema: z.object({
        category: z.string().max(40).optional().describe("Only projects in this category, e.g. 'Agents'"),
        status: z.enum(["completed", "in-progress"]).optional(),
        featured_only: z.boolean().optional().describe("Only the projects I feature on my About page"),
      }),
    },
  );

  const getProject = tool(
    async ({ id }) => {
      const project = (await getProjects()).find((p) => p.id === id);
      if (!project) return "No project has that id. Call list_projects to see the ids.";
      run.read.push(projectItem(project));
      step(`read project: ${project.title}`);
      return json({
        id: project.id,
        title: project.title,
        date: project.date,
        status: project.status,
        category: project.category,
        description: project.description,
        details: project.details,
        stack: project.stack,
        has_live_demo: Boolean(project.links.live),
        has_source_code: Boolean(project.links.github),
      });
    },
    {
      name: "get_project",
      description: "Read the full record for one project: the detailed write-up with results and numbers, the stack, and whether it has a live demo or public source.",
      schema: z.object({ id: z.string().max(80).describe("The project id, e.g. 'atlas'") }),
    },
  );

  const listArticles = tool(
    async () => {
      const articles = await getArticles();
      for (const article of articles) run.read.push(articleItem(article));
      step(`listed articles, ${count(articles.length, "result", "results")}`);
      return json(articles.map((a) => ({ id: a.id, title: a.title, date: a.date, reading_time: a.readingTime, summary: a.summary, topics: a.tags })));
    },
    {
      name: "list_articles",
      description: "List every article I have written, newest first, with id, title, date, reading time, summary and topics. This is everything stored about each article.",
      schema: z.object({}),
    },
  );

  const listContent = tool(
    async ({ kind }) => {
      let posts = await getPosts();
      if (kind) posts = posts.filter((p) => p.kind.toLowerCase() === kind.toLowerCase());
      for (const post of posts) run.read.push(postItem(post));
      step(`listed content, ${count(posts.length, "result", "results")}`);
      return json(
        posts.map((c) => {
          const { platform, length } = postWhere(c);
          return {
            id: c.id,
            kind: c.kind,
            title: c.title,
            platform,
            length,
            date: c.date,
            summary: c.summary,
            details: c.details,
            topics: c.tags,
          };
        }),
      );
    },
    {
      name: "list_content",
      description: "List the videos, talks, threads and other content I have shared, with id, kind, title, platform, length, date, summary and details. This is everything stored about each one.",
      schema: z.object({ kind: z.string().max(30).optional().describe("Only this kind, e.g. 'Video' or 'Talk'") }),
    },
  );

  const getProfileTool = tool(
    async () => {
      const profile = await getProfile();
      step("read my profile");
      return json({ name: profile.name, tagline: profile.tagline, background: profile.background, focus_areas: profile.focus });
    },
    {
      name: "get_profile",
      description: "Read who I am: my background and the kinds of work I focus on. Use it for questions about me rather than a specific project.",
      schema: z.object({}),
    },
  );

  const getContact = tool(
    async () => {
      const profile = await getProfile();
      step("read my contact details");
      return json({ email: profile.email, availability: profile.availability, links: profile.links });
    },
    {
      name: "get_contact",
      description: "Read how to reach me: email, availability for work, and social links.",
      schema: z.object({}),
    },
  );

  const search = tool(
    async ({ query }) => {
      const hits = await searchContent(query, 6);
      step(`searched my work for "${query}", ${count(hits.length, "match", "matches")}`);
      return json(hits.map(({ type, id, title, summary }) => ({ type, id, title, summary })));
    },
    {
      name: "search_portfolio",
      description:
        "Full-text search across my projects, articles and content. Returns the best matches with their type and id. Use it when the question is about a topic and you don't yet know which items are relevant. Pass a few keywords, not a sentence.",
      schema: z.object({ query: z.string().min(1).max(120).describe("A few keywords, e.g. 'retrieval chunking'") }),
    },
  );

  // ---------- Display tools ----------

  /** Keeps the requested order, drops unknown ids and repeats, and reports back what was shown. */
  function pick<T extends { id: string; title: string }>(all: T[], wanted: string[]): { found: T[]; reply: string } {
    const found = [...new Set(wanted)].flatMap((id) => all.filter((item) => item.id === id));
    const missing = wanted.filter((id) => !all.some((item) => item.id === id));
    for (const item of found) run.shown.add(item.id);
    const reply = found.length ? `Shown to the visitor as cards: ${found.map((f) => f.title).join(", ")}.` : "Nothing was shown.";
    return { found, reply: missing.length ? `${reply} These ids do not exist and were skipped: ${missing.join(", ")}.` : reply };
  }

  const showProjects = tool(
    async ({ ids: wanted }) => {
      const { found, reply } = pick(await getProjects(), wanted);
      if (found.length) run.emit({ t: "ui", block: { kind: "projects", items: found } });
      return reply;
    },
    {
      name: "show_projects",
      description:
        "Show project cards under your answer. Each card already displays the project's preview, title, date, status, description, stack and links, so your text does not need to repeat those. Use it whenever your answer is about specific projects.",
      schema: z.object({ ids: ids(4) }),
    },
  );

  const showArticles = tool(
    async ({ ids: wanted }) => {
      const { found, reply } = pick(await getArticles(), wanted);
      if (found.length) run.emit({ t: "ui", block: { kind: "articles", items: found } });
      return reply;
    },
    {
      name: "show_articles",
      description: "Show a list of articles under your answer. Each row displays the date, title, summary and reading time, and links to the article.",
      schema: z.object({ ids: ids(5) }),
    },
  );

  const showContent = tool(
    async ({ ids: wanted }) => {
      const { found, reply } = pick(await getPosts(), wanted);
      if (found.length) run.emit({ t: "ui", block: { kind: "content", items: found } });
      return reply;
    },
    {
      name: "show_content",
      description: "Show tiles for videos, talks and other content under your answer. Each tile displays the kind, title, summary and where it was published.",
      schema: z.object({ ids: ids(6) }),
    },
  );

  const showContact = tool(
    async () => {
      const profile = await getProfile();
      run.emit({ t: "ui", block: { kind: "contact", email: profile.email, availability: profile.availability, links: profile.links } });
      return "Shown to the visitor: a contact card with my email, a copy button, my availability and my social links.";
    },
    {
      name: "show_contact",
      description: "Show a contact card under your answer with my email, a copy button, availability and social links. Use it when someone wants to reach or hire me.",
      schema: z.object({}),
    },
  );

  const suggestFollowups = tool(
    async ({ questions }) => {
      run.emit({ t: "followups", questions });
      return "Shown to the visitor as suggested next questions.";
    },
    {
      name: "suggest_followups",
      description:
        "Offer the visitor up to three short next questions, shown as buttons under your answer. Write them as the visitor would ask them, and only suggest questions my saved content can answer.",
      schema: z.object({ questions: z.array(z.string().min(3).max(80)).min(1).max(3) }),
    },
  );

  return [listProjects, getProject, listArticles, listContent, getProfileTool, getContact, search, showProjects, showArticles, showContent, showContact, suggestFollowups];
}
