/* eslint-disable @next/next/no-img-element */
import type { Project } from "@/lib/types";

const stepClass = ["pv-a1", "pv-a2", "pv-a3", "pv-a4", "pv-a5"];

/** The visual at the top of a project card: a looping mini demo, or a screenshot or GIF framed on the backdrop. */
export function ProjectPreview({ project, className = "mb-3 rounded-[10px]" }: { project: Project; className?: string }) {
  const { preview } = project;
  return (
    <div className={`relative aspect-[16/10.4] overflow-hidden scene-${project.backdrop} ${className}`}>
      {preview.kind === "image" ? (
        <div className="pv-shot">
          <img src={preview.src} alt={preview.alt} className="size-full object-cover" />
        </div>
      ) : (
        <div className={`pv ${project.window === "light" ? "pv-light" : ""}`} aria-hidden="true">
          <Visual preview={preview} />
        </div>
      )}
    </div>
  );
}

function Visual({ preview }: { preview: Exclude<Project["preview"], { kind: "image" }> }) {
  switch (preview.kind) {
    case "trace":
      return (
        <>
          <span className="pv-cap">{preview.caption}</span>
          {preview.steps.slice(0, 5).map((step, i) => (
            <span key={step} className={`pv-step ${stepClass[i]}`}>
              {step}
            </span>
          ))}
        </>
      );
    case "search":
      return (
        <>
          <span className="pv-cap">{preview.query}</span>
          {preview.results.slice(0, 3).map((result, i) => (
            <div key={result.label} className="pv-hit">
              <span>
                {result.label}
                <i style={{ width: `${Math.round(result.score * 100)}%`, animationDelay: `${i * 0.35}s` }} />
              </span>
              <b>{result.score.toFixed(2).replace(/^0/, "")}</b>
            </div>
          ))}
        </>
      );
    case "bars":
      return (
        <>
          <span className="pv-cap">{preview.caption}</span>
          <div className="pv-bars">
            {preview.values.map((value, i) => (
              <i key={i} style={{ height: `${value}%`, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
          <span className="pv-verdict pv-a3">{preview.verdict}</span>
        </>
      );
    case "voice":
      return (
        <>
          <span className="pv-who">{preview.top}</span>
          <div className="pv-lane pv-lane-a">
            {Array.from({ length: 22 }, (_, i) => (
              <i key={i} style={{ animationDelay: `-${((i * 0.37) % 0.9).toFixed(2)}s`, animationDuration: `${(0.6 + (i % 5) * 0.12).toFixed(2)}s` }} />
            ))}
          </div>
          <span className="pv-who" style={{ marginTop: "8%" }}>
            {preview.bottom}
          </span>
          <div className="pv-lane pv-lane-b">
            {Array.from({ length: 22 }, (_, i) => (
              <i key={i} style={{ animationDelay: `-${((i * 0.23) % 0.9).toFixed(2)}s`, animationDuration: `${(0.55 + (i % 4) * 0.15).toFixed(2)}s` }} />
            ))}
          </div>
        </>
      );
    case "diff":
      return (
        <>
          <span className="pv-cap">{preview.caption}</span>
          <div className="pv-diff">
            <span className="pv-del pv-a1">- {preview.removed}</span>
            <span className="pv-add pv-a2">+ {preview.added}</span>
            {preview.notes.slice(0, 2).map((note, i) => (
              <span key={note} className={`pv-note ${i === 0 ? "pv-a3" : "pv-a4"}`}>
                {note}
              </span>
            ))}
          </div>
        </>
      );
    case "curve":
      return (
        <div className="pv-curve h-full">
          <span className="pv-cap">{preview.caption}</span>
          <svg viewBox="0 0 100 50" preserveAspectRatio="none">
            <path className="pv-axis" d="M0 49.5H100" />
            <path pathLength={1} d="M0 4 C8 22 12 30 20 33 S32 38 42 40 S60 44 72 44.5 S90 46 100 46" />
          </svg>
          <span className="pv-a5 block">{preview.note}</span>
        </div>
      );
  }
}
