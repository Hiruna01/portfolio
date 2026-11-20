"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { KoiPond } from "koi-pond";

// The koi ink (the library's default blue, lighter in dark mode), read from the stylesheet so the koi follow the theme.
function inkColour() {
  return getComputedStyle(document.documentElement).getPropertyValue("--koi").trim() || "#1a42e2";
}

// Full strength at the sides of the window, nearly gone behind the 720px reading column, so text
// always sits on a clean page. On windows narrower than the column the whole pond stays faint.
const FADE =
  "linear-gradient(to right, black, black calc(50% - 560px), rgb(0 0 0 / 0.07) calc(50% - 370px), rgb(0 0 0 / 0.07) calc(50% + 370px), black calc(50% + 560px), black)";

// The dithered koi pond behind every public page (koi-pond, WebGL2). It lives in the root layout,
// so the same pond keeps swimming as the visitor moves between pages. It sits under everything and
// ignores the pointer: the library only reads the pointer's position from the window, so the fish
// react while the page stays clickable. The admin area has no pond.
export function PondBackground() {
  const hidden = usePathname().startsWith("/admin");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (hidden || !canvas) return;
    let pond: KoiPond | null = null;
    let cancelled = false;

    // Loaded in the browser only: the library touches the document as soon as it starts.
    import("koi-pond").then(({ createKoiPond }) => {
      if (cancelled) return;
      pond = createKoiPond({ canvas, ink: inkColour(), background: "transparent", count: 8, pixelSize: 2, speed: 0.8 });
    });

    // The theme toggle changes data-theme on <html>; repaint the koi in the new colour.
    const observer = new MutationObserver(() => pond?.set({ ink: inkColour() }));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      cancelled = true;
      observer.disconnect();
      pond?.destroy();
    };
  }, [hidden]);

  if (hidden) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10" style={{ maskImage: FADE, WebkitMaskImage: FADE }}>
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}
