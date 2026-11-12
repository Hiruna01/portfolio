import type { Profile } from "@/lib/types";

// Placeholder profile. Replace every value here with your own.
// The About page and the agent both read from this file.
export const profile: Profile = {
  name: "Hiruna Dilmith",
  initials: "HD",
  photo: "/badge-image.png",
  tagline: "Agents that hold up outside the demo",
  intro: [
    "I'm an AI engineer focused on agents, retrieval, and the evaluation work that tells you whether either one is getting better.",
    "Currently, I'm building Atlas, a research agent that plans, searches and writes briefs where every claim has a citation. I like small prompts, explicit tools, and numbers I can trust before shipping.",
    "Before this I worked in backend engineering. This site is agent-first: you can ask it anything about my work, or browse the pages the usual way.",
  ],
  background:
    "I started in backend engineering and moved to applied AI when language models became good enough to build products on. Most of my time now goes into agent loops, retrieval quality, and the evaluation work that shows whether either one is improving.",
  focus: [
    "Designing and shipping agentic features",
    "Fixing retrieval that returns the wrong thing",
    "Setting up evals a team will keep running",
  ],
  availability: "Open to collaborations. I usually reply within a couple of days.",
  email: "hello@yourdomain.com",
  links: [
    { label: "GitHub", url: "https://github.com/your-handle" },
    { label: "LinkedIn", url: "https://www.linkedin.com/in/your-handle" },
    { label: "X", url: "https://x.com/your-handle" },
  ],
};
