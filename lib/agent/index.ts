import Anthropic from "@anthropic-ai/sdk";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { GraphRecursionError } from "@langchain/langgraph";
import { articleItem, postItem, projectItem } from "../content";
import type { AgentSettings } from "../schemas";
import { getAgentSettings, getArticles, getPosts, getProfile, getProjects, searchContent } from "../store";
import type { ChatEvent, Item, Profile } from "../types";
import { buildGraph, textOf } from "./graph";
import type { ToolRun } from "./tools";

type Send = (event: ChatEvent) => void;
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Context = { profile: Profile; settings: AgentSettings };

const GUARD_MODEL = "claude-haiku-5-5";
/** Upper bound on graph steps for one question: roughly six rounds of model call plus tools. */
const RECURSION_LIMIT = 16;
const MAX_SOURCES = 4;

/** True when the server has credentials for the Claude API. Without them the chat runs in demo mode. */
export function hasCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function loadContext(): Promise<Context> {
  const [profile, settings] = await Promise.all([getProfile(), getAgentSettings()]);
  return { profile, settings };
}

/** The Claude models for a request, configured from the admin's agent settings. */
function createModels(settings: AgentSettings): { model: BaseChatModel; guard: BaseChatModel | null } {
  const model = new ChatAnthropic({
    model: settings.model,
    maxTokens: settings.maxTokens,
    streaming: true,
    outputConfig: { effort: settings.effort },
    // If the model declines a request, the API retries it on a fallback model in the same call.
    // Haiku has no server-side fallback, so the option is only sent for the other models.
    ...(settings.model === "claude-haiku-5-5" ? {} : { betas: ["server-side-fallback-2026-07-01"], invocationKwargs: { fallbacks: "default" } }),
  });
  const guard = settings.guardEnabled
    ? new ChatAnthropic({ model: GUARD_MODEL, maxTokens: 1000, outputConfig: { effort: "low" }, maxRetries: 1 })
    : null;
  return { model, guard };
}

const toMessages = (history: ChatMessage[]): BaseMessage[] =>
  history.map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)));

function dedupe(items: Item[]): Item[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/**
 * Runs one question through the graph and streams steps, answer text, cards and sources to the browser.
 * `models` is only passed by tests, to run the graph without calling the API.
 */
export async function runAgent(
  history: ChatMessage[],
  { profile, settings }: Context,
  send: Send,
  signal: AbortSignal,
  models: { model: BaseChatModel; guard: BaseChatModel | null } = createModels(settings),
): Promise<void> {
  const run: ToolRun = { emit: send, read: [], shown: new Set() };
  const graph = buildGraph({ ...models, name: profile.name, settings, run });

  let wroteText = false;
  try {
    const stream = await graph.stream({ messages: toMessages(history) }, { streamMode: ["messages", "updates"], recursionLimit: RECURSION_LIMIT, signal });
    for await (const [mode, chunk] of stream) {
      if (mode === "messages") {
        // Token-by-token output. Only the agent node's text goes to the visitor; the guard's verdict does not.
        const [message, meta] = chunk as [BaseMessage, { langgraph_node?: string }];
        if (meta.langgraph_node !== "agent" || !AIMessageChunk.isInstance(message)) continue;
        const delta = textOf(message.content);
        if (delta) {
          wroteText = true;
          send({ t: "text", d: delta });
        }
      } else {
        const update = (chunk as { agent?: { messages?: BaseMessage[] } }).agent;
        const reply = update?.messages?.[update.messages.length - 1];
        if (!AIMessage.isInstance(reply)) continue;
        const refused = (reply.response_metadata as { stop_reason?: string } | undefined)?.stop_reason === "refusal";
        // Anything written before a tool call is interim narration, not the answer.
        if ((reply.tool_calls?.length || refused) && wroteText) {
          send({ t: "clear" });
          wroteText = false;
        }
        if (refused) send({ t: "text", d: "I can't help with that one. Ask me about my projects, my writing, or how to reach me." });
      }
    }
  } catch (err) {
    if (!(err instanceof GraphRecursionError)) throw err;
    // The agent kept calling tools without settling on an answer. Stop it rather than let it run on.
    if (!wroteText) send({ t: "text", d: "I couldn't pull that together. Try asking about one project or topic at a time." });
  }

  // Source chips for things the agent read but did not show as a card.
  const sources = dedupe(run.read.filter((item) => !run.shown.has(item.id))).slice(0, MAX_SOURCES);
  if (sources.length && run.shown.size === 0) send({ t: "sources", items: sources });
}

/** Maps errors to a message that is safe to show a visitor. LangChain passes the Anthropic SDK's errors through. */
export function publicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return "The agent is not configured correctly. You can still browse the pages from the menu.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "The agent is busy right now. Try again in a minute.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "The agent could not be reached. Check your connection and try again.";
  }
  if (err instanceof Anthropic.APIError) {
    return "The agent ran into a problem answering that. Try again, or browse the pages from the menu.";
  }
  return "Something went wrong answering that. Try again.";
}

/**
 * Demo mode: used when no API key is set, so the site works out of the box.
 * Answers come from the same database search and a template, not from a model.
 */
export async function runDemo(history: ChatMessage[], { profile, settings }: Context, send: Send): Promise<void> {
  const question = history[history.length - 1].content;
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const say = async (text: string) => {
    for (const word of text.split(" ")) {
      send({ t: "text", d: word + " " });
      await pause(22);
    }
  };
  send({ t: "demo" });

  const lower = question.toLowerCase();
  if (/contact|email|reach|hire|hiring|available|work with/.test(lower)) {
    send({ t: "step", label: "read my contact details" });
    await pause(300);
    await say("Email is the best way to reach me. Here are my details.");
    send({ t: "ui", block: { kind: "contact", email: profile.email, availability: profile.availability, links: profile.links } });
  } else if (/who are|background|yourself|about you|experience/.test(lower)) {
    send({ t: "step", label: "read my profile" });
    await pause(300);
    await say(profile.background);
  } else {
    const hits = await searchContent(question, 4);
    send({ t: "step", label: `searched my work for "${question}", ${hits.length} ${hits.length === 1 ? "match" : "matches"}` });
    await pause(300);
    if (!hits.length) {
      await say("I haven't published anything on that yet. The areas I work in most are agents, retrieval and evaluation, so try asking about one of those.");
    } else {
      const wanted = (type: Item["type"]) => new Set(hits.filter((h) => h.type === type).map((h) => h.id));
      const [projects, articles, posts] = await Promise.all([getProjects(), getArticles(), getPosts()]);
      const shownProjects = projects.filter((p) => wanted("project").has(p.id)).slice(0, 2);
      const shownArticles = articles.filter((a) => wanted("article").has(a.id));
      const shownPosts = posts.filter((c) => wanted("content").has(c.id));
      for (const item of [...shownProjects.map(projectItem), ...shownArticles.map(articleItem), ...shownPosts.map(postItem)]) {
        send({ t: "step", label: `read ${item.kind}: ${item.title}` });
      }
      await say(
        shownProjects.length
          ? `The closest thing I've built is **${shownProjects[0].title}**. Here's what I have on that.`
          : "I haven't shipped a project on exactly that, but I have covered it. Here's what I have.",
      );
      if (shownProjects.length) send({ t: "ui", block: { kind: "projects", items: shownProjects } });
      if (shownArticles.length) send({ t: "ui", block: { kind: "articles", items: shownArticles } });
      if (shownPosts.length) send({ t: "ui", block: { kind: "content", items: shownPosts } });
    }
  }
  const next = settings.suggestions.filter((s) => s.toLowerCase() !== lower).slice(0, 3);
  if (next.length) send({ t: "followups", questions: next });
}
