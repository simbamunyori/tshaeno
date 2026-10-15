import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "@/server/env";
import { DomainError } from "@/server/org/access";

/**
 * Calls to Claude, for drafting signatures and reviewing them against the
 * brand. Optional: everything else works without an API key, and these
 * features only show once ANTHROPIC_API_KEY is set.
 */

export interface Claude {
  client: Pick<Anthropic, "messages">;
  model: string;
}

let cached: Claude | null | undefined;

export function claude(): Claude | null {
  if (cached !== undefined) return cached;
  const e = env();
  cached = e.ANTHROPIC_API_KEY ? { client: new Anthropic({ apiKey: e.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 2 }), model: e.ANTHROPIC_MODEL } : null;
  return cached;
}

export const aiAvailable = () => claude() !== null;

/** Our copy rules, applied to anything Claude writes that people will read. */
export function plainCopy(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/!+/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Asks Claude to answer by filling in one tool's input, and checks the
 * answer against the same schema. Throws a DomainError people can read.
 */
export async function askForTool<T>(
  c: Claude,
  input: { system: string; prompt: string; tool: { name: string; description: string; schema: z.ZodType<T> }; maxTokens?: number },
): Promise<T> {
  const inputSchema = z.toJSONSchema(input.tool.schema, { target: "draft-7", io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete inputSchema.$schema;
  let response;
  try {
    response = await c.client.messages.create({
      model: c.model,
      max_tokens: input.maxTokens ?? 4000,
      system: input.system,
      tools: [{ name: input.tool.name, description: input.tool.description, input_schema: inputSchema as Anthropic.Tool.InputSchema }],
      tool_choice: { type: "tool", name: input.tool.name },
      messages: [{ role: "user", content: input.prompt }],
    });
  } catch (e) {
    console.warn("Claude request failed", e);
    throw new DomainError("conflict", "Claude couldn't be reached just now. Try again in a minute.");
  }
  const use = response.content.find((b) => b.type === "tool_use" && b.name === input.tool.name);
  const parsed = use && use.type === "tool_use" ? input.tool.schema.safeParse(use.input) : null;
  if (!parsed?.success) {
    console.warn("Claude's answer didn't fit", parsed?.error?.issues?.slice(0, 5));
    throw new DomainError("conflict", "Claude's answer didn't come out right. Try again, or say it a little differently.");
  }
  return parsed.data;
}
