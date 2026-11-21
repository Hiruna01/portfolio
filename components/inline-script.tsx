"use client";

/**
 * An inline script that runs once, from the server HTML, before the page paints. On the client the same
 * element is rendered as inert text, which is what stops React warning about a <script> in the tree;
 * suppressHydrationWarning accepts the type difference. Pattern from the Next.js guide
 * "Preventing flash before hydration". Only ever pass it fixed code, never saved content.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
