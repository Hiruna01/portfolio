import { flushSync } from "react-dom";

// The theme lives on <html data-theme>, set before first paint by the script in app/layout.tsx.

export function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export const isDarkTheme = () => document.documentElement.dataset.theme === "dark";

function applyTheme(next: "light" | "dark") {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {}
}

/**
 * Switches between light and dark. The new theme spreads out from `origin` (a point in the window)
 * as a growing circle, using the View Transitions API. Browsers without it, and visitors who prefer
 * reduced motion, get an instant switch. `onApplied` runs in the same update as the switch.
 */
export function switchTheme(origin: { x: number; y: number }, onApplied?: () => void, duration = 500) {
  const next = isDarkTheme() ? "light" : "dark";
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const apply = () => {
    applyTheme(next);
    onApplied?.();
  };

  if (!document.startViewTransition || reduceMotion) {
    flushSync(apply);
    return;
  }

  // Colour transitions would make the new snapshot start from the old colours.
  root.classList.add("theme-switching");
  const transition = document.startViewTransition(() => {
    flushSync(apply);
  });
  transition.finished.catch(() => {}).finally(() => root.classList.remove("theme-switching"));

  const { x, y } = origin;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  // ready rejects when the browser skips the transition (a hidden tab, say); the theme still switches.
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {});
}
