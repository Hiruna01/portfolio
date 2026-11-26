import type { CSSProperties } from "react";

/**
 * A heading whose letters are drawn in as vector outlines, one after another, then filled.
 * The text is real SVG text in the page's font, so it stays sharp at any size; screen readers
 * read the plain copy, not the drawing. The animation is the `.drawn-heading` rules in globals.css
 * (no motion with prefers-reduced-motion). It plays again whenever the heading mounts.
 */
export function DrawnHeading({ text, className = "" }: { text: string; className?: string }) {
  return (
    <h1 className={className}>
      <span className="sr-only">{text}</span>
      <svg aria-hidden="true" className="drawn-heading block h-[1.08em] w-full overflow-visible">
        <text x="50%" y="0.84em" textAnchor="middle" style={{ whiteSpace: "pre" }}>
          {Array.from(text).map((letter, i) => (
            <tspan key={i} style={{ "--i": i } as CSSProperties}>
              {letter}
            </tspan>
          ))}
        </text>
      </svg>
    </h1>
  );
}
