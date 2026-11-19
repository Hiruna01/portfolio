"use client";

import { ArrowUp, Square } from "lucide-react";
import { useImperativeHandle, useLayoutEffect, useRef, type FormEvent, type ReactNode, type Ref } from "react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "./input-group";

const MAX_HEIGHT = 168; // about six lines

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  /** True while a reply is streaming: the send button becomes the stop button. */
  busy: boolean;
  disabled?: boolean;
  placeholder: string;
  /** Gives the parent the text field, so it can move focus there. */
  inputRef?: Ref<HTMLTextAreaElement | null>;
  /** Extra controls shown before the text, at the start of the bar. */
  actions?: ReactNode;
  /** Controls shown after the text, before the send button (the microphone). */
  controls?: ReactNode;
};

/**
 * The chat composer, built on Input Group after the shadcn.io Prompt Input pattern: one rounded bar
 * holding a textarea that grows with its text, and one submit button that sends, or stops the reply while one is streaming.
 * Enter sends and Shift+Enter starts a new line.
 */
export function PromptInput({ value, onChange, onSend, onStop, busy, disabled, placeholder, inputRef, actions, controls }: Props) {
  const canSend = !disabled && value.trim().length > 0;

  const fieldRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle<HTMLTextAreaElement | null, HTMLTextAreaElement | null>(inputRef, () => fieldRef.current, []);

  // Grow the field with its text, up to MAX_HEIGHT, then scroll.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  // The stop button stays a submit button: switching its type mid-click would let the same click
  // submit the form and send whatever was typed meanwhile.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) onStop();
    else if (canSend) onSend(value.trim());
  }

  return (
    <form onSubmit={handleSubmit}>
      <InputGroup>
        {actions && (
          <InputGroupAddon align="inline-start" className="pb-[9px] pl-[9px]">
            {actions}
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          ref={fieldRef}
          rows={1}
          value={value}
          maxLength={600}
          autoComplete="off"
          disabled={disabled}
          aria-label="Your question"
          placeholder={placeholder}
          className={`min-w-0 py-[17px] pr-2 ${actions ? "pl-2" : "pl-6"}`}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault();
              if (!busy) event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <InputGroupAddon align="inline-end" className="gap-1 pb-[9px] pr-[9px]">
          {controls}
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-sm"
            pill
            aria-label={busy ? "Stop the answer" : "Send question"}
            disabled={!busy && !canSend}
          >
            {busy ? (
              <Square className="size-3" fill="currentColor" strokeWidth={0} aria-hidden="true" />
            ) : (
              <ArrowUp className="size-[18px]" strokeWidth={2} aria-hidden="true" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
