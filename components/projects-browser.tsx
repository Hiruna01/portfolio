"use client";

import { useState } from "react";

/**
 * Category tabs for the projects grid. Cards are rendered on the server and passed in,
 * so this only decides which ones are visible.
 */
export function ProjectsBrowser({ cards }: { cards: { id: string; category: string; card: React.ReactNode }[] }) {
  const categories = ["All", ...Array.from(new Set(cards.map((c) => c.category)))];
  const [active, setActive] = useState("All");

  return (
    <>
      <div role="group" aria-label="Filter projects" className="mb-5 inline-flex flex-wrap gap-0.5 rounded-full p-[3px] shadow-[0_1px_2px_rgba(16,17,19,0.06),0_0_0_1px_var(--line)]">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={active === category}
            onClick={() => setActive(category)}
            className={`rounded-full px-[11px] py-[3px] text-[12.5px] transition-colors hover:text-strong ${active === category ? "bg-chip text-strong" : ""}`}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="grid gap-[18px] sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.id} hidden={active !== "All" && c.category !== active} className="contents">
            {c.card}
          </div>
        ))}
      </div>
    </>
  );
}
