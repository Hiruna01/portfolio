"use client";

import { Mic } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { InputGroupButton } from "./ui/input-group";

// The browser's speech recognition (Web Speech API). TypeScript's DOM types do not include it,
// so only the parts used here are described.
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const never = () => () => {};

type Props = {
  /** The text already in the field when dictation starts. */
  value: string;
  /** Called with the field's new text as words are recognised. */
  onText: (text: string) => void;
  disabled?: boolean;
};

/**
 * Dictation for the prompt bar. Speech is turned into text by the browser and added to whatever is
 * already typed; nothing is sent until the visitor presses send. Browsers without speech recognition
 * (Firefox, at the time of writing) get no button.
 */
export function MicButton({ value, onText, disabled }: Props) {
  // False on the server and during hydration, then the real answer in the browser.
  const supported = useSyncExternalStore(
    never,
    () => Boolean(recognitionClass()),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = recognitionClass();
    if (!Recognition) return;
    const recognition = new Recognition();
    const before = value.trim();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const heard = Array.from(event.results, (result) => result[0].transcript).join("").trim();
      onText([before, heard].filter(Boolean).join(" ").slice(0, 600));
    };
    // Also runs when the visitor refuses microphone access or stops talking.
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  return (
    <InputGroupButton
      pill
      size="icon-sm"
      disabled={disabled}
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? "Stop dictation" : "Dictate your question"}
      title={listening ? "Stop dictation" : "Dictate"}
      className={listening ? "animate-pulse bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent hover:text-accent" : "text-strong"}
    >
      <Mic className="size-[19px]" strokeWidth={1.6} aria-hidden="true" />
    </InputGroupButton>
  );
}
