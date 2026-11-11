"use client";

import { Moon, Sun } from "lucide-react";
import { useRef, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

type Props = {
  className?: string;
  /** Length of the circular reveal in milliseconds. */
  duration?: number;
};

// The theme lives on <html data-theme>, set before first paint by the script in app/layout.tsx.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.dataset.theme === "dark";

function applyTheme(next: "light" | "dark") {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {}
}

/**
 * Switches between light and dark. The new theme spreads out from the button as a
 * growing circle, using the View Transitions API. Browsers without it, and visitors
 * who prefer reduced motion, get an instant switch.
 */
export function AnimatedThemeToggler({ className = "", duration = 500 }: Props) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    const next = isDark() ? "light" : "dark";
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!document.startViewTransition || reduceMotion || !buttonRef.current) {
      applyTheme(next);
      return;
    }

    // Colour transitions would make the new snapshot start from the old colours.
    root.classList.add("theme-switching");
    const transition = document.startViewTransition(() => {
      flushSync(() => applyTheme(next));
    });
    transition.finished
      .catch(() => {})
      .finally(() => root.classList.remove("theme-switching"));

    const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
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

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={className}
    >
      {dark ? (
        <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  );
}
