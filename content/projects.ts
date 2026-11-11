import type { Project } from "@/lib/types";

// Placeholder projects. Replace with your own; newest first.
// `preview` picks the animated visual on the card. To use a screenshot instead:
//   preview: { kind: "image", src: "/projects/atlas.png", alt: "Atlas home screen" }
// and put the file in public/projects/.
export const projects: Project[] = [
  {
    id: "atlas",
    title: "Atlas",
    date: "Sep 2026",
    status: "in-progress",
    category: "Agents",
    description:
      "A research agent that plans, searches and writes briefs where every claim has a citation.",
    details:
      "Atlas breaks a question into sub-questions, runs searches in parallel, and refuses to write a claim it cannot cite. The hard part was stopping it from over-searching, which I solved with a budget the planner has to spend deliberately. Cited-claim accuracy is 94.1% on my eval set, with a median of 71 seconds per brief and about 11 tool calls per task.",
    stack: ["Python", "Claude", "LangGraph", "Postgres"],
    tags: ["agent", "agents", "agentic", "planning", "research", "tools", "search"],
    links: { live: "#", github: "#" },
    preview: {
      kind: "trace",
      caption: "atlas run 0412",
      steps: [
        "plan: 4 sub-questions",
        'search "solid-state cell cost"',
        'search "2026 pack prices"',
        "read 6 sources",
        "brief written, 12 citations",
      ],
    },
    window: "dark",
    backdrop: "sea",
    featured: true,
  },
  {
    id: "recall",
    title: "Recall",
    date: "Jun 2026",
    status: "completed",
    category: "Retrieval",
    description:
      "Hybrid search over personal notes, with answers that link back to the exact source line.",
    details:
      "Recall combines keyword and vector search, then reranks. Chunk boundaries follow the structure of the note instead of a fixed token count, which did more for quality than any model swap. Recall@5 is 0.91, answer faithfulness 0.96, and p95 latency 420 ms.",
    stack: ["TypeScript", "pgvector", "BM25", "Next.js"],
    tags: ["rag", "retrieval", "search", "embeddings", "vector", "notes", "chunking", "rerank"],
    links: { live: "#", github: "#" },
    preview: {
      kind: "search",
      query: "where did I note the pgvector index settings?",
      results: [
        { label: "infra/postgres.md, line 48", score: 0.91 },
        { label: "journal/2026-03-02.md", score: 0.74 },
        { label: "reading/ann-indexes.md", score: 0.52 },
      ],
    },
    window: "light",
    backdrop: "cloud",
    featured: true,
  },
  {
    id: "evalkit",
    title: "Evalkit",
    date: "Nov 2025",
    status: "completed",
    category: "Evaluation",
    description:
      "Runs LLM evals in CI and fails the build when a score drops beyond its noise band.",
    details:
      "Evalkit treats an eval like a test: it lives next to the code, runs on every pull request, and fails the build when a score drops beyond its noise band. Six teams use it, running about 3,200 evals a week, and it has caught 41 regressions before merge.",
    stack: ["Python", "pytest", "DuckDB"],
    tags: ["eval", "evals", "evaluation", "testing", "ci", "metrics", "quality", "regression"],
    links: { github: "#" },
    preview: {
      kind: "bars",
      caption: "faithfulness, last 9 commits",
      values: [82, 84, 83, 88, 90, 89, 91, 92, 61],
      verdict: "build failed: score fell 31 points",
    },
    window: "dark",
    backdrop: "moss",
    featured: true,
  },
  {
    id: "voiceline",
    title: "Voiceline",
    date: "Aug 2025",
    status: "completed",
    category: "Agents",
    description:
      "A realtime voice agent for booking calls that recovers gracefully when the caller interrupts.",
    details:
      "Most voice agents fall apart when the caller talks over them. Voiceline keeps a running plan of the conversation so it can drop a sentence midway and pick the thread back up. Task completion is 88%, the median response gap is 540 ms, and it handles 93% of interruptions.",
    stack: ["Node", "WebRTC", "Whisper", "ElevenLabs"],
    tags: ["voice", "realtime", "speech", "audio", "agent", "agents", "phone", "latency"],
    links: { live: "#", github: "#" },
    preview: { kind: "voice", top: "caller", bottom: "voiceline" },
    window: "dark",
    backdrop: "plum",
  },
  {
    id: "promptdiff",
    title: "Promptdiff",
    date: "Mar 2025",
    status: "completed",
    category: "Evaluation",
    description:
      "Shows what changed in model behaviour when a prompt changes, before it reaches users.",
    details:
      "Promptdiff replays a saved set of real inputs against the old and new prompt and groups the differences by kind, so a reviewer reads ten clusters instead of five hundred outputs. Review time per prompt change dropped by 68%, with a 4% false-alarm rate.",
    stack: ["Go", "SQLite", "React"],
    tags: ["prompt", "prompts", "regression", "testing", "diff", "evals", "review"],
    links: { github: "#" },
    preview: {
      kind: "diff",
      caption: "system prompt, v14 to v15",
      removed: "Answer briefly.",
      added: "Answer in two sentences, then offer detail.",
      notes: ["137 of 500 replies changed", "3 kinds of change to review"],
    },
    window: "dark",
    backdrop: "ember",
  },
  {
    id: "tiny-tuner",
    title: "Tiny-tuner",
    date: "Dec 2024",
    status: "completed",
    category: "Models",
    description:
      "A one-command LoRA fine-tuning pipeline for small open models, with an eval report at the end.",
    details:
      "Tiny-tuner takes a JSONL file and returns a served adapter with an eval report. I built it to find out when a small tuned model beats a large prompted one, which turned out to be more often than I expected. On my classification task it cut cost by 83% against a hosted baseline at 0.93 F1, with an adapter ready in 19 minutes.",
    stack: ["PyTorch", "PEFT", "Modal"],
    tags: ["fine-tuning", "finetune", "lora", "training", "models", "open source", "small"],
    links: { github: "#" },
    preview: { kind: "curve", caption: "training loss", note: "adapter ready in 19 min" },
    window: "light",
    backdrop: "dusk",
  },
];
