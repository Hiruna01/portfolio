# Portfolio

An agent-first personal portfolio. The home page is a chat with an AI agent that answers from the site's own content; About, Projects, Articles and Content are there for browsing. Everything is edited from an admin area at `/admin`.

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run admin:hash
npm run dev
```

`npm run admin:hash` asks for a password and prints the `ADMIN_PASSWORD_HASH` line to paste into `.env.local`, next to an `ADMIN_USERNAME` of your choice.

Locally the site needs no database setup: it keeps a file database in `.data/`, filled with the starter content from `content/` on first run. Without an `ANTHROPIC_API_KEY` the agent runs in demo mode (database search and a template, no model).

## Deploy to Vercel

1. Create a Neon Postgres database and add its connection string as `DATABASE_URL`.
2. Add `ANTHROPIC_API_KEY`, `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`.
3. For image uploads from the admin, connect a Vercel Blob store (this adds `BLOB_READ_WRITE_TOKEN`).
4. Deploy. Tables are created and seeded on the first request.

## Edit the content

Sign in at `/admin`. Changes to projects, articles, content, your profile and the agent's settings show on the site straight away.

See `CLAUDE.md` for the structure, design rules and security model.
