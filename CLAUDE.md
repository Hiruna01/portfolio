# Portfolio

Hiruna Dilmith's personal portfolio. The site is agent-first: the home page is a chat with an AI agent that answers as Hiruna from the site's own content. The classic pages (About, Projects, Articles, Content) exist for visitors who would rather browse.

@AGENTS.md

## Before calling a change done

Run `npm run lint`, `npx tsc --noEmit` and `npm run build`. The build catches Cache Components mistakes that lint and tsc do not. Hosting target is Vercel.

## Layout notes

- `prototypes/` holds the three static HTML design prototypes. The site was built from `minimal-live.html`. Keep them for reference; don't import from them.

## Content and data

Content lives in Postgres and is edited at `/admin`. The files in `content/` only seed a new, empty database.

- Tables: `items` (projects, articles and content as JSON documents with a position), `settings` (`profile` and `agent`), `sessions`, `attempts` (rate-limit counters), `audit` (activity log). The schema is created automatically on first connection; see `SCHEMA` in `lib/db.ts`. There is no migration tool yet, so a schema change needs a manual `ALTER` or a new idempotent statement there.
- With `DATABASE_URL` set the site uses Neon. Without it, local development uses PGlite files in `.data/`. On Vercel a missing `DATABASE_URL` is an error.
- PGlite allows one instance on its files; a second one corrupts them (it happened twice, 21 and 22 November). Next 16's dev server runs helper workers that load `lib/db.ts` afresh ("use cache" probes and dev validation as worker threads, `generateStaticParams` as a jest-worker child process without `JEST_WORKER_ID`). `inHelperWorker` in `lib/db.ts` keeps them on the starter content, and `.data/pglite.lock` (the real process id) makes a second server fail with a clear error. Keep both when changing database code. A damaged `.data/pglite` was repaired by running `pg_resetwal -f` (PostgreSQL 18) on a copy.
- `next build` without `DATABASE_URL` renders pages from the seed files, because the file database cannot be opened by several build workers at once.
- Public pages and the agent read through the cached getters in `lib/store.ts` (`getProjects` and so on), all tagged `content`. Every admin save calls `updateTag("content")`, so changes show immediately.
- Every record is validated with its zod schema on write and again on read. A row that fails validation is skipped, not rendered.
- To add a field: add it to the schema in `lib/schemas.ts`, the type in `lib/types.ts`, and the form definition in `lib/admin-forms.ts`.
- Items marked featured appear on the About page (first 2 projects, 3 articles, 3 posts).
- Each project has its own page at `/projects/[id]` (`app/projects/[id]/page.tsx`), opened by clicking anywhere on its card (the title's link covers the card; the footer links sit above it) and from the chat's project rows. It shows the preview scaled up, the `details` field as limited Markdown (headings allowed there, via `Markdown long`), then `media` (pictures and videos), the stack, and links to the previous and next project. `details` is not shown on the card; the agent reads it too.
- A project's `media` is a list of images and videos, entered in the admin one per line as `address | caption`, with image uploads. Videos are YouTube or Vimeo links, embedded through `youtube-nocookie.com` and `player.vimeo.com`, or direct .mp4/.webm/.mov files; `lib/media.ts` decides which. A Vercel request body is capped around 4.5 MB, so large images go up a few at a time.
- Content cards (`components/post-cards.tsx`) show a 16:9 thumbnail with the platform and length on it. Clicking one opens a detail popup (a native `<dialog>`) with the post's `details`, and the address becomes `/content#id`, so links to that address open the card. Without an uploaded `thumbnail`, one is drawn from the title in the platform's colour; platform icons and colours are in `components/icons.tsx`. Posts saved before the `platform` field existed keep it at the start of `meta` ("YouTube, 21 min"); `postWhere` in `lib/content.ts` reads both forms.
- Project categories become the filter tabs on the Projects page automatically.
- Item ids are unique across projects, articles and content, because the agent looks items up by id alone. An id cannot be changed after creation.
- List order is the `position` column, changed with the up and down arrows in the admin.

## The agent

Built on LangGraph.js with Claude through `@langchain/anthropic`. Code is in `lib/agent/`.

- `graph.ts` defines the graph: `guard -> agent <-> tools`, with `guard -> redirect` for off-topic questions. It also holds the agent's system prompt and the guard prompt.
  - guard: `claude-haiku-5-5` answers "portfolio" or "other". Off-topic questions get a fixed reply from the redirect node and never reach the main model. If the guard errors, the question goes through. It can be switched off in the admin.
  - agent: the main model with the tools bound.
  - tools: LangGraph's `ToolNode`.
- `tools.ts` defines the tools. All are read-only.
  - Data tools read the database: `list_projects`, `get_project`, `list_articles`, `list_content`, `get_profile`, `get_contact`, `search_portfolio` (Postgres full-text search, `searchContent` in `lib/store.ts`).
  - Display tools decide what the visitor sees: `show_projects`, `show_articles`, `show_content`, `show_contact`, `suggest_followups`. They take ids only; the server loads the records and sends them as cards, so the model cannot invent a card's contents.
- `index.ts` has `runAgent` (streams the graph to the browser), `runDemo`, `loadContext`, `publicError` and model setup.
- The system prompt contains no site content. The agent learns what exists only through tools. Hiruna asked for this explicitly; do not put a content index back in the prompt.
- The prompt's core rules are fixed in `graph.ts`. The admin's extra instructions are appended below them and told not to override them. Keep it that way.
- Conversation history is sent by the browser with each question. There is no server-side memory, no checkpointer and no tracing (Hiruna's choices).
- The route streams newline-delimited JSON events: `step`, `text`, `clear`, `ui`, `followups`, `sources`, `demo`, `error`, `done`. See `ChatEvent` and `UiBlock` in `lib/types.ts`. Change the server and `components/chat.tsx` together.
- In the chat, `ui` blocks render as compact rows in `components/chat-blocks.tsx`. A project row's thumbnail is the real `ProjectPreview` scaled down. Answer text is rendered as limited Markdown by `components/markdown.tsx`: emphasis, lists, links and inline code only, never raw HTML.
- Settings come from the `agent` row in `settings`, edited at `/admin/agent`: on/off, question screening, model (allow-list in `AGENT_MODELS`), effort, answer length limit, suggested questions, extra instructions and the per-visitor rate limit.
- Visitors cannot choose a model. A picker was built and removed at Hiruna's request; the model is only the admin's setting.
- One question is capped at 16 graph steps (`RECURSION_LIMIT`). The chat rate limit is counted in the `attempts` table.
- The server-side refusal fallback is sent for every model except Haiku, which does not support it.
- Demo mode: with no `ANTHROPIC_API_KEY` the route answers from the same database search and a template, and still shows cards. The chat shows a notice.
- The graph has only been run with scripted fake models and in demo mode, not yet against the live Claude API. Check a real conversation after an API key is added.
- To test the graph without the API, pass fake models as the last argument of `runAgent`.
- The API key lives only in the server environment. It is never shown or editable in the admin, never in client code, never committed.
- The agent must not be given tools that write, or that reach outside the site, without asking Hiruna first.

## The project drafter

An admin-only helper that drafts a new project from a public GitHub repository. Code is in `lib/drafter/`; it is deliberately separate from the chat agent (Hiruna's decision), because it reaches outside the site and its input is untrusted.

- On `/admin/projects/new`, `ProjectDrafter` (`components/admin/project-drafter.tsx`) puts a "Draft from GitHub" box above the form. `draftProjectAction` in `app/admin/actions.ts` calls `requireAdmin()`, allows 20 drafts an hour (the `draft` bucket in `attempts`), and logs each draft. It saves nothing: the admin reviews the marked fields and saves with the form's own button.
- On a project's edit page the same box is "Refresh from README", prefilled with the project's GitHub link. A refresh rewrites the text fields but keeps the id, date, pictures and videos, featured flag, preview window and backdrop, and the live link unless the repository names a homepage. Without a key it keeps the saved title, description, status and write-up. Only fields whose value changed are marked.
- `github.ts` accepts only `https://github.com/<owner>/<repo>`, calls only `api.github.com`, rejects private repositories, strips images and badges from the README and caps it at 40k characters. Public repositories only; there is no `GITHUB_TOKEN`.
- `index.ts` is a fixed flow, not a tool loop: fetch, one structured-output call (`client.beta.messages.parse` with `betaZodOutputFormat`, the admin's model from `/admin/agent` at effort `medium`), trim to the project schema, and one retry with the problems if it still fails. LangChain's `withStructuredOutput` is not used because it forces a tool call, which Opus 5.5, Sonnet 5.5 and Fable 5.2 reject.
- The id, GitHub link, live link (the repository's homepage) and date come from GitHub, never from the model, so a README cannot put its own link on the site. The README is passed as data inside `<readme>` tags and the prompt says not to follow instructions in it.
- It fills every field except pictures and videos, featured, preview window and backdrop, including a text card preview. Without `ANTHROPIC_API_KEY` it fills only what the repository's details give.
- To test without the API, pass a fake `Generate` function as the second argument of `draftProject`.
- It has only been run with a fake model, not yet against the live Claude API.

## Design rules

These came out of several rounds of review with Hiruna. Keep to them unless asked otherwise.

- One narrow column, 720px wide, with plenty of space. Minimal, calm, premium.
- Cards (projects, content tiles, chat source cards) have a rounded dashed outline. Article rows use dashed dividers.
- Project cards: preview on top, title with date on the right, a status line, description, outlined stack chips, then a footer split into "Live link" and "GitHub" by dashed dividers.
- No page-wide guide lines. They were tried and removed.
- Agent answers are a sentence or three of text with results underneath. The results carry the details; the text should not repeat them.
- In the chat, results are one compact list inside a single dashed box (`ChatResults` in `components/chat-blocks.tsx`), not the large browse-page cards. Every row shares three columns: a lead (project thumbnail, article date, or content kind), the title with a two-line summary, and a trailing detail. Hiruna found full-size cards in the chat unstructured and heavy; keep rows compact and aligned.
- The chat page follows the ChatGPT layout: centred heading, rounded input and suggestions when empty, with no profile picture anywhere on the chat page (Hiruna asked for it to be removed); then questions as bubbles on the right, answers on the left, input pinned to the bottom. The input is `PromptInput` (`components/ui/prompt-input.tsx`), built on `components/ui/input-group.tsx` after the shadcn.io Prompt Input pattern: one fully rounded bar with a growing text area and a button that sends, or stops the answer while it streams; in a conversation a plus button at its start begins a new chat. The bar has no leading icon and no model picker (both removed at Hiruna's request). Before the send button sits a dictation button (`components/mic-button.tsx`, the browser's speech recognition, hidden where unsupported). Suggestions are a plain list of rows, each with an icon, that tint on hover. The agent's steps fold into one "Answered in N steps" line above the answer.
- Behind every public page is a dithered koi pond (`components/pond-background.tsx`, mounted once in the root layout and left out of `/admin`, using Hiruna's own `koi-pond` library, installed from `github:Hiruna01/ascii-koi` at a pinned tag; its types are in `types/koi-pond.d.ts`). It is drawn in the `--koi` colour (the library's default blue, lighter in dark mode) so it follows the theme, and masked so it is at full strength at the sides of the window and nearly gone behind the 720px column, so text stays readable. The chat results box has a translucent backing for the same reason.
- Every page keeps a visible way to the other mode: browse links on the agent page, an "ask the agent" link on browse pages.
- Colours are CSS variables in `app/globals.css`, exposed to Tailwind as `bg-bg`, `text-strong`, `text-body`, `text-soft`, `border-line`, `border-dash`, `bg-chip`, `bg-raise`, `text-ok`, `text-warn`, `text-accent`. The accent is one blue ink, used only for the active nav link, link hovers, the chat send button, focus rings and the `:target` highlight; do not add a second accent. Dark mode swaps the variables under `[data-theme="dark"]`, so don't add `dark:` variants.
- Fonts are Geist and Geist Mono. Mono is for metadata only.
- Icons come from `lucide-react` (the set shadcn/ui uses). lucide has no brand logos, so GitHub, LinkedIn and X are inline SVGs in `components/icons.tsx`; `SocialIcon` picks one by the link's label.
- There is no profile picture anywhere on the site (Hiruna asked for it to be removed). The profile's old `initials` and `photo` values are still accepted on read but no longer edited or shown.
- On the About page the intro, "what I can help with" and "get in touch" blocks stack vertically, not side by side.
- The animated previews are plain CSS classes prefixed `pv-` in `globals.css`, on a shared 8 second loop. Respect `prefers-reduced-motion`.
- A "Screenshot or GIF" preview sits in the same rounded window as the animated ones (`.pv-shot`), on the project's backdrop gradient, not full-bleed. The backdrops are the `scene-*` classes in `globals.css`; the admin picks one with a row of gradient swatches (the `swatches` field kind in `components/admin/form.tsx`).
- Copy is plain and first person. No all-caps labels.

## Working with Hiruna

- Hiruna is an AI engineer and wants this site to show a different, agentic way of presenting a portfolio. Favour changes that make the agent more useful over adding more static pages.
- Ask before building when a request is open-ended; Hiruna prefers to choose between options, ideally shown as something to look at.

## Admin and security

One admin, no sign-up, no second factor yet (Hiruna chose to leave it for later). These rules are the security model; do not weaken them without asking.

- Credentials: `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` (scrypt, made with `npm run admin:hash`) in environment variables. Never put a password or hash in source code.
- Sessions: a random token in an httpOnly, SameSite=Strict cookie (`__Host-admin_session` in production). The database stores only the token's SHA-256 hash. Sessions last 8 hours; sign-out deletes the row.
- Every admin page calls `requireAdmin()` first, and every server action in `app/admin/actions.ts` calls it too. Server actions are public endpoints, so the page check alone is never enough. `proxy.ts` is only a fast pre-check on the cookie's presence.
- Login is rate limited: 5 failures per IP and 30 overall per 15 minutes. The check always runs the password hash and returns the same message for a wrong username or password.
- All saved data goes through the zod schemas. Links must be `https://`, `http://`, a path starting with `/`, or `#`. Content is always rendered as text by React; never use `dangerouslySetInnerHTML` with saved content.
- Uploads: PNG, JPEG, WebP or GIF only (GIF added for animated card previews), identified by file signature, 4 MB limit, stored under a random name. On Vercel they go to Blob storage (`BLOB_READ_WRITE_TOKEN`); locally to `public/uploads/`.
- Security headers, including the content security policy, are set in `next.config.ts`. Frames are allowed only from `www.youtube-nocookie.com` and `player.vimeo.com`, and media from https addresses, for videos on project pages. The microphone is allowed for this site only (`microphone=(self)`), for dictation in the chat. `/admin` is `noindex` and `no-store`.
- Admin pages set `instant = false` (the panel layout and every page under it, so navigations between admin pages are not validated as instant either) and call `connection()` through `requireAdmin`, so they are never prerendered.
- The activity log records sign-ins, failed sign-ins and every change.
- `.env.local` holds a generated local test login. It must be replaced before deploying.
