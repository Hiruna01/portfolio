"use client";

import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";
import { DecryptedText } from "@/components/ui/decrypted-text";

export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <a href={`mailto:${email}`} className="inline-flex items-center gap-2 font-medium text-strong underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent">
        <Mail className="size-4 text-soft" aria-hidden="true" strokeWidth={1.5} />
        {/* Decodes letter by letter when it scrolls into view, and again on hover. */}
        <DecryptedText
          text={email}
          animateOn="inViewHover"
          sequential
          revealDirection="start"
          speed={35}
          characters="abcdefghijklmnopqrstuvwxyz0123456789@._-"
          scrambleColor="var(--soft)"
        />
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Email address copied" : "Copy email address"}
        className={`grid size-[22px] place-items-center transition-colors hover:text-strong ${copied ? "text-ok" : "text-soft"}`}
      >
        {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" strokeWidth={1.5} />}
      </button>
    </span>
  );
}
