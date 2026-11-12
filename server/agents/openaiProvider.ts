import type Anthropic from "@anthropic-ai/sdk";
import { ENV } from "../_core/env";

// Adaptador para os agentes rodarem num modelo da OpenAI (Chat Completions).
//
// O histórico dos agentes continua gravado no formato de blocos da Anthropic
// (text, tool_use, tool_result, image): a tela e as ferramentas dependem dele.
// A cada passo, o histórico é traduzido para mensagens da OpenAI, o modelo é
// chamado (em streaming, para respostas longas não estourarem o tempo limite) e a
// resposta é traduzida de volta para blocos.

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type Tool = { name: string; description?: string; input_schema: unknown };

// Itens de entrada da Responses API.
type InputItem =
  | { role: "user"; content: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }> }
  | { role: "assistant"; content: string }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

export type ProviderStep = {
  content: Anthropic.Beta.Messages.BetaContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "refusal";
  usage: Record<string, unknown>;
};

export class OpenAIError extends Error {
  constructor(public status: number, message: string) {
    super(`API da OpenAI (${status}): ${message}`);
  }
}

type Block = { type: string; [k: string]: unknown };

/** Conteúdo de um tool_result → texto + imagens (a saída de função só aceita texto). */
function splitToolResult(content: unknown): { text: string; images: string[] } {
  if (typeof content === "string") return { text: content, images: [] };
  const blocks = (Array.isArray(content) ? content : []) as Block[];
  const text = blocks.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("\n");
  const images = blocks
    .filter((b) => b.type === "image")
    .map((b) => {
      const src = b.source as { type?: string; media_type?: string; data?: string; url?: string } | undefined;
      if (src?.type === "base64" && src.data) return `data:${src.media_type ?? "image/png"};base64,${src.data}`;
      if (src?.type === "url" && src.url) return src.url;
      return null;
    })
    .filter((u): u is string => Boolean(u));
  return { text: text || (images.length ? "(imagem na mensagem seguinte)" : "(sem conteúdo)"), images };
}

/** Histórico em blocos da Anthropic → itens de entrada da Responses API. */
export function toResponsesInput(messages: MessageParam[]): InputItem[] {
  const out: InputItem[] = [];
  for (const m of messages) {
    const blocks = (typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content) as Block[];
    if (m.role === "assistant") {
      // Blocos só da Anthropic (thinking, fallback…) de execuções antigas no Claude são ignorados.
      const text = blocks.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("\n").trim();
      if (text) out.push({ role: "assistant", content: text });
      for (const b of blocks.filter((x) => x.type === "tool_use")) {
        out.push({ type: "function_call", call_id: String(b.id), name: String(b.name), arguments: JSON.stringify(b.input ?? {}) });
      }
      continue;
    }
    // Usuário: as saídas de função e, depois, texto do usuário + imagens devolvidas pelas ferramentas.
    const parts: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }> = [];
    for (const b of blocks) {
      if (b.type === "tool_result") {
        const { text, images } = splitToolResult(b.content);
        out.push({ type: "function_call_output", call_id: String(b.tool_use_id), output: b.is_error ? `ERRO: ${text}` : text });
        if (images.length) {
          parts.push({ type: "input_text", text: "Imagem devolvida pela ferramenta acima:" });
          images.forEach((url) => parts.push({ type: "input_image", image_url: url }));
        }
      } else if (b.type === "text" && String(b.text ?? "").trim()) {
        parts.push({ type: "input_text", text: String(b.text) });
      } else if (b.type === "image") {
        splitToolResult([b]).images.forEach((url) => parts.push({ type: "input_image", image_url: url }));
      }
    }
    if (parts.length) out.push({ role: "user", content: parts });
  }
  return out;
}

const toResponsesTools = (tools: Tool[]) =>
  tools.map((t) => ({ type: "function" as const, name: t.name, description: t.description ?? "", parameters: t.input_schema, strict: false }));

/**
 * Um passo do agente na OpenAI (Responses API: ferramentas + raciocínio).
 * `forceTool` obriga a chamar uma ferramenta (ex.: submit_item).
 */
export async function openaiStep(opts: {
  model: string; system: string; tools: Tool[]; messages: MessageParam[]; maxTokens: number; forceTool?: string;
}): Promise<ProviderStep> {
  if (!ENV.openaiApiKey) throw new Error("OPENAI_API_KEY não configurada.");
  const res = await fetch(`${ENV.openaiApiBaseUrl.replace(/\/$/, "")}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.openaiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      instructions: opts.system,
      input: toResponsesInput(opts.messages),
      ...(opts.tools.length ? { tools: toResponsesTools(opts.tools) } : {}),
      ...(opts.forceTool ? { tool_choice: { type: "function", name: opts.forceTool } } : {}),
      max_output_tokens: opts.maxTokens,
      store: false,
      // Streaming só para manter a conexão viva em respostas longas; o resultado vem no evento final.
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new OpenAIError(res.status, err.error?.message ?? res.statusText);
  }

  type Output = { type: string; content?: Array<{ type: string; text?: string; refusal?: string }>; call_id?: string; name?: string; arguments?: string };
  type Final = { status?: string; incomplete_details?: { reason?: string } | null; output?: Output[]; usage?: Record<string, unknown>; error?: { message?: string } | null };
  let final: Final | null = null;
  const decoder = new TextDecoder();
  let buffer = "";
  const reader = res.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!data || data === "[DONE]") continue;
      const ev = JSON.parse(data) as { type?: string; response?: Final; message?: string; error?: { message?: string } };
      if (ev.type === "error") throw new OpenAIError(500, ev.message ?? ev.error?.message ?? "erro no streaming");
      if (ev.type === "response.failed") throw new OpenAIError(500, ev.response?.error?.message ?? "a resposta falhou");
      if (ev.type === "response.completed" || ev.type === "response.incomplete") final = ev.response ?? null;
    }
  }
  if (!final) throw new OpenAIError(500, "a resposta terminou sem resultado");

  const content: Anthropic.Beta.Messages.BetaContentBlock[] = [];
  let refused = false;
  const text = (final.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []).map((c) => {
    if (c.type === "refusal") { refused = true; return c.refusal ?? ""; }
    return c.type === "output_text" ? c.text ?? "" : "";
  }).join("");
  if (text.trim()) content.push({ type: "text", text, citations: null } as Anthropic.Beta.Messages.BetaContentBlock);
  const calls = (final.output ?? []).filter((o) => o.type === "function_call");
  for (const c of calls) {
    let input: unknown = {};
    try { input = c.arguments ? JSON.parse(c.arguments) : {}; } catch { input = { __erro_json: "Argumentos em JSON inválido; envie de novo.", bruto: (c.arguments ?? "").slice(0, 500) }; }
    content.push({ type: "tool_use", id: String(c.call_id), name: String(c.name), input } as Anthropic.Beta.Messages.BetaContentBlock);
  }
  const stop_reason = refused ? "refusal"
    : final.status === "incomplete" && final.incomplete_details?.reason === "max_output_tokens" ? "max_tokens"
    : calls.length ? "tool_use" : "end_turn";
  return { content, stop_reason, usage: final.usage ?? {} };
}
