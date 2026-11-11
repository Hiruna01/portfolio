import type { Article } from "@/lib/types";

// Placeholder articles. Replace with your own; newest first.
// `summary` is what the agent reads, so make it say what the article argues.
export const articles: Article[] = [
  {
    id: "agent-loop",
    title: "What an agent loop actually does",
    date: "Oct 2026",
    readingTime: "9 min",
    summary:
      "A plain walk through one turn of an agent: what the model sees, what it decides, and where things go wrong.",
    url: "#",
    tags: ["agent", "agents", "loop", "tools", "planning"],
    featured: true,
  },
  {
    id: "chunking",
    title: "Chunking is a retrieval decision, not preprocessing",
    date: "Aug 2026",
    readingTime: "12 min",
    summary:
      "Chunk boundaries decide what can be found, so they belong to the retriever. Structure-aware chunks beat fixed token windows.",
    url: "#",
    tags: ["rag", "retrieval", "chunking", "embeddings", "search"],
    featured: true,
  },
  {
    id: "evals-first",
    title: "Write the evals before the prompt",
    date: "Jun 2026",
    readingTime: "7 min",
    summary:
      "If you can't say what good looks like, no prompt will get you there. Start with twenty real examples and a pass rule.",
    url: "#",
    tags: ["eval", "evals", "evaluation", "prompt", "testing"],
    featured: true,
  },
  {
    id: "tool-design",
    title: "Designing tools an agent can use well",
    date: "Mar 2026",
    readingTime: "10 min",
    summary:
      "Tool names, arguments and error messages matter more than the system prompt. Design them like an API for a new teammate.",
    url: "#",
    tags: ["agent", "agents", "tools", "design", "api"],
  },
  {
    id: "context-engineering",
    title: "Notes on context engineering",
    date: "Jan 2026",
    readingTime: "8 min",
    summary:
      "What to put in the context window, what to leave out, and how to tell the difference with measurements.",
    url: "#",
    tags: ["context", "prompt", "prompts", "memory", "agents"],
  },
];
