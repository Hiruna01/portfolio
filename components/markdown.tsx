import ReactMarkdown from "react-markdown";

/**
 * Renders the agent's answer. Only a small set of Markdown is allowed (emphasis, lists, links, inline code);
 * anything else, including raw HTML, is shown as plain text. Links open in a new tab unless they point at this site.
 */
export function Markdown({ children, long = false }: { children: string; long?: boolean }) {
  return (
    <div className={long ? "space-y-4 text-strong" : "space-y-2.5 text-strong"}>
      <ReactMarkdown
        // Longer write-ups (a project's page) may also use ## and ### headings.
        allowedElements={["p", "strong", "em", "ul", "ol", "li", "a", "code", "br", ...(long ? ["h2", "h3"] : [])]}
        unwrapDisallowed
        components={{
          a: ({ href, children: label }) => {
            const internal = typeof href === "string" && href.startsWith("/");
            return (
              <a
                href={href}
                {...(internal ? {} : { target: "_blank", rel: "noreferrer" })}
                className="underline decoration-soft underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
              >
                {label}
              </a>
            );
          },
          h2: ({ children: text }) => <h2 className="pt-6 text-[22px] font-medium tracking-[-0.02em] text-strong">{text}</h2>,
          h3: ({ children: text }) => <h3 className="pt-3 text-[17px] font-medium text-strong">{text}</h3>,
          ul: ({ children: items }) => <ul className="list-disc space-y-1 pl-5">{items}</ul>,
          ol: ({ children: items }) => <ol className="list-decimal space-y-1 pl-5">{items}</ol>,
          strong: ({ children: text }) => <strong className="font-semibold">{text}</strong>,
          code: ({ children: text }) => <code className="rounded bg-chip px-1 py-0.5 font-mono text-[0.9em]">{text}</code>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
