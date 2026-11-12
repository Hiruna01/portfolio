import type { Post } from "@/lib/types";

// Placeholder videos, talks and posts for the Content page. Replace with your own.
// Without a thumbnail, each card draws one from its title in the platform's colour.
export const posts: Post[] = [
  {
    id: "rag-video",
    kind: "Video",
    title: "Build a retrieval pipeline in 20 minutes",
    platform: "YouTube",
    date: "Sep 2026",
    meta: "21 min",
    summary: "A start-to-finish build, including the evaluation step most tutorials skip.",
    details:
      "We go from a folder of documents to answers with citations, then measure whether the answers are any good.\n\n- Chunking, and why chunk size changes the answers\n- Hybrid search: BM25 and vectors together\n- A 20-question eval set you can reuse\n\nThe notebook and the dataset are linked in the video description.",
    url: "#",
    tags: ["rag", "retrieval", "video", "tutorial", "embeddings"],
    featured: true,
  },
  {
    id: "agent-failures",
    kind: "Thread",
    title: "Seven ways agents fail in production",
    platform: "X",
    date: "Aug 2026",
    meta: "9 posts",
    summary: "The failures I see most often, each with the fix I reach for first.",
    details:
      "Loops that never end, tools called with made-up arguments, context that quietly overflows, and four more. Each post names the failure, how to spot it in your traces, and the first fix I try.",
    url: "#",
    tags: ["agent", "agents", "failure", "production"],
    featured: true,
  },
  {
    id: "shipping-talk",
    kind: "Talk",
    title: "Shipping LLM features without guessing",
    platform: "Meetup",
    date: "Jul 2026",
    meta: "25 min",
    summary: "Getting from a demo to something you can put your name on, using evals as the release gate.",
    details:
      "A talk about the gap between a demo that works once and a feature you can ship. I cover how to write a first eval set in an afternoon, how to read the results without fooling yourself, and how to make the eval the thing that decides a release.",
    url: "#",
    tags: ["evals", "evaluation", "shipping", "talk", "quality"],
    featured: true,
  },
  {
    id: "embeddings-short",
    kind: "Short",
    title: "Embeddings explained in 60 seconds",
    platform: "YouTube",
    date: "Jun 2026",
    meta: "1 min",
    summary: "The shortest honest explanation of embeddings I could manage.",
    url: "#",
    tags: ["embeddings", "vector", "retrieval", "explain"],
  },
  {
    id: "tuning-live",
    kind: "Video",
    title: "Fine-tuning a small model, live",
    platform: "YouTube",
    date: "May 2026",
    meta: "48 min",
    summary: "An unedited session: data prep, training, and the moment the eval disagrees with me.",
    details:
      "No cuts. I prepare a small dataset, train a LoRA adapter on a small open model, and compare it against the base model on an eval I wrote beforehand. Part of it does not go to plan, which is the useful part.",
    url: "#",
    tags: ["fine-tuning", "lora", "training", "models", "video"],
  },
  {
    id: "field-notes",
    kind: "Newsletter",
    title: "Field notes on building with LLMs",
    platform: "Substack",
    meta: "Monthly",
    summary: "One thing I learned shipping AI features each month, with the numbers behind it.",
    details: "Short, practical, and once a month. Each issue is one lesson from real work, with the numbers that taught it to me.",
    url: "#",
    tags: ["newsletter", "notes", "llm", "building"],
  },
];
