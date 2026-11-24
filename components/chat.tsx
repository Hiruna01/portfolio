"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ChatEvent, Item, UiBlock } from "@/lib/types";
import { ChatResults } from "./chat-blocks";
import { Markdown } from "./markdown";
import { MicButton } from "./mic-button";
import { InputGroupButton } from "./ui/input-group";
import { PromptInput } from "./ui/prompt-input";

type Turn = {
  id: number;
  question: string;
  steps: string[];
  answer: string;
  blocks: UiBlock[];
  followups: string[];
  sources: Item[];
  error?: string;
  pending: boolean;
};

const BROWSE = [
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/articles", label: "Articles" },
  { href: "/content", label: "Content" },
];

const STORAGE_KEY = "chat-turns";

type Props = { name: string; suggestions: string[]; enabled: boolean };

export function Chat({ name, suggestions, enabled }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [demo, setDemo] = useState(false);
  const [restored, setRestored] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const busy = turns.some((t) => t.pending);
  const started = turns.length > 0;

  // The conversation survives a visit to another page and back, within the same tab.
  // sessionStorage only exists in the browser, so it is read after hydration rather than during render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setTurns((JSON.parse(saved) as Turn[]).map((t) => ({ ...t, blocks: t.blocks ?? [], followups: t.followups ?? [], pending: false })));
    } catch {}
    // The chosen model is remembered across visits.
    try {
    } catch {}
    setRestored(true);
    return () => abortRef.current?.abort();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.filter((t) => !t.pending)));
    } catch {}
  }, [turns, restored]);

  // The pond shows in full behind the empty page, and the middle fades back once the first question
  // is asked, so answers sit on a clean page. The fade itself is the .pond rule in globals.css.
  useEffect(() => {
    const root = document.documentElement;
    if (restored && !started) root.dataset.pond = "open";
    else delete root.dataset.pond;
    return () => {
      delete root.dataset.pond;
    };
  }, [restored, started]);

  useEffect(() => {
    if (started) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, started]);

  function patch(id: number, change: (turn: Turn) => Turn) {
    setTurns((all) => all.map((t) => (t.id === id ? change(t) : t)));
  }

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || busy || !enabled) return;
    setInput("");

    const id = Date.now();
    const history = turns
      .filter((t) => t.answer && !t.error)
      .flatMap((t) => [
        { role: "user" as const, content: t.question },
        { role: "assistant" as const, content: t.answer },
      ]);
    setTurns((all) => [...all, { id, question, steps: [], answer: "", blocks: [], followups: [], sources: [], pending: true }]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content: question }] }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "The agent could not answer that. Try again.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as ChatEvent;
          if (event.t === "step") patch(id, (t) => ({ ...t, steps: [...t.steps, event.label] }));
          else if (event.t === "text") patch(id, (t) => ({ ...t, answer: t.answer + event.d }));
          else if (event.t === "clear") patch(id, (t) => ({ ...t, answer: "" }));
          else if (event.t === "ui") patch(id, (t) => ({ ...t, blocks: [...t.blocks, event.block] }));
          else if (event.t === "followups") patch(id, (t) => ({ ...t, followups: event.questions }));
          else if (event.t === "sources") patch(id, (t) => ({ ...t, sources: event.items }));
          else if (event.t === "error") patch(id, (t) => ({ ...t, error: event.message }));
          else if (event.t === "demo") setDemo(true);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Stopped by the visitor. Keep whatever had arrived; say so if nothing had.
        patch(id, (t) => (t.answer.trim() || t.blocks.length ? t : { ...t, error: "Stopped." }));
      } else {
        const message = err instanceof Error && err.message ? err.message : "The agent could not answer that. Try again.";
        patch(id, (t) => ({ ...t, error: message }));
      }
    } finally {
      patch(id, (t) => ({ ...t, answer: t.answer.trim(), pending: false }));
      inputRef.current?.focus();
    }
  }

  function reset() {
    abortRef.current?.abort();
    setTurns([]);
    inputRef.current?.focus();
  }

  function stop() {
    abortRef.current?.abort();
  }

  const composer = (
    <PromptInput
      value={input}
      onChange={setInput}
      onSend={ask}
      onStop={stop}
      busy={busy}
      disabled={!enabled}
      inputRef={inputRef}
      placeholder={!enabled ? "The agent is switched off right now" : started ? "Ask a follow-up" : "Ask about my projects, writing or experience"}
      controls={<MicButton value={input} onText={setInput} disabled={!enabled || busy} />}
      actions={
        started && (
          <InputGroupButton pill size="icon-sm" onClick={reset} aria-label="New chat" title="New chat" className="text-soft hover:text-strong">
            <Plus className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
          </InputGroupButton>
        )
      }
    />
  );

  const browse = (
    <nav aria-label="Browse the site" className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-[13px] text-soft">
      <span className="mr-1">Prefer to browse?</span>
      {BROWSE.map((page) => (
        <Link key={page.href} href={page.href} className="rounded-full px-2 py-0.5 text-body underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent">
          {page.label}
        </Link>
      ))}
    </nav>
  );

  if (!started) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-60px)] max-w-[720px] flex-col px-6">
        <div className="my-auto pb-[8vh] pt-8 text-center">
          <h1 className="rise mb-9 text-[44px] font-medium leading-none tracking-[-0.045em] text-strong sm:text-[60px]" style={order(1)}>
            Ask {name.split(" ")[0]}.
          </h1>
          <div className="rise relative z-10 mx-auto max-w-[580px]" style={order(2)}>
            {composer}
          </div>
          {enabled && suggestions.length > 0 && (
            <ul className="rise mx-auto mt-5 flex max-w-[580px] flex-wrap justify-center gap-2" style={order(3)}>
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="cursor-pointer rounded-full border border-line bg-raise/80 px-3.5 py-[7px] text-[13.5px] leading-none text-body backdrop-blur-sm transition-colors hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] hover:text-strong"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rise pb-6" style={order(4)}>
          {browse}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-60px)] max-w-[720px] flex-col px-6">
      <div className="flex-1 pb-5 pt-4" aria-live="polite">
        {turns.map((turn) => (
          <section key={turn.id} className="rise py-5">
            <p className="mb-6 flex justify-end">
              <span className="max-w-[82%] rounded-[20px] bg-chip px-4 py-[9px] text-strong">{turn.question}</span>
            </p>
            <div>
                <Steps steps={turn.steps} working={turn.pending && !turn.answer} />
                {turn.answer && (
                  <div className="mb-4 text-[16.5px] leading-[1.7]">
                    <Markdown>{turn.answer}</Markdown>
                  </div>
                )}
                {turn.error && (
                  <p className="mb-3.5 text-strong" role="alert">
                    {turn.error}
                  </p>
                )}
                {turn.blocks.length > 0 && (
                  <div className="mb-3.5">
                    <ChatResults blocks={turn.blocks} />
                  </div>
                )}
                {turn.sources.length > 0 && (
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                    {turn.sources.map((source) => (
                      <li key={source.id}>
                        <Link
                          href={source.href}
                          className="block h-full rounded-[10px] border border-dashed border-dash px-3 py-[9px] transition-colors hover:border-soft"
                        >
                          <span className="block font-mono text-[11.5px] text-soft">{source.kind}</span>
                          <span className="block text-[13.5px] leading-[1.35] text-strong">{source.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {!busy && turn.id === turns[turns.length - 1].id && turn.followups.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {turn.followups.map((followup) => (
                      <button
                        key={followup}
                        type="button"
                        onClick={() => ask(followup)}
                        className="cursor-pointer rounded-full bg-raise/70 px-3.5 py-1.5 text-left text-[13.5px] shadow-[0_0_0_1px_var(--line)] transition-[color,box-shadow] hover:text-accent hover:shadow-[0_0_0_1px_var(--accent)]"
                      >
                        {followup}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </section>
        ))}
        <div ref={endRef} />
      </div>

      {/* The bar blurs what scrolls under it, and its top edge fades out so answers and the koi pass behind it softly. */}
      <div className="sticky bottom-0 isolate -mx-6 px-6 pb-4 pt-9">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-bg/75 backdrop-blur-md [mask-image:linear-gradient(to_bottom,transparent,black_30px)]" />
        {composer}
        <div className="mt-3">{browse}</div>
        {demo && (
          <p className="mt-2 text-center font-mono text-[11.5px] text-soft">
            Demo mode: no API key is set, so answers come from a database search and a template instead of a model.
          </p>
        )}
      </div>
    </main>
  );
}

/** Position in the load sequence, read by the `.rise` animation in globals.css. */
function order(i: number) {
  return { "--i": i } as CSSProperties;
}

/**
 * What the agent did to answer. While it works, the current step shows on one line; afterwards the
 * steps fold into a single line that opens on click, so they don't sit between the question and the answer.
 */
function Steps({ steps, working }: { steps: string[]; working: boolean }) {
  if (working) {
    return (
      <p className="mb-3 mt-[5px] flex items-center gap-[9px] font-mono text-xs text-soft">
        <span className="size-[5px] shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />
        {steps.length ? steps[steps.length - 1] : "thinking"}
      </p>
    );
  }
  if (steps.length === 0) return null;
  return (
    <details className="group mb-2.5 mt-[5px] font-mono text-xs text-soft">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 transition-colors hover:text-strong [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3 transition-transform group-open:rotate-90" strokeWidth={2} aria-hidden="true" />
        Answered in {steps.length} {steps.length === 1 ? "step" : "steps"}
      </summary>
      <ul className="mt-1.5 pl-4">
        {steps.map((step, i) => (
          <li key={i} className="py-px">
            {step}
          </li>
        ))}
      </ul>
    </details>
  );
}
