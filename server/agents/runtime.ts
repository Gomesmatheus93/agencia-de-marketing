import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ENV } from "../_core/env";
import { getAgent, type AgentDefinition } from "./registry";
import * as store from "./store";
import { TASKS, type TaskDefinition } from "./tasks";
import { AGENT_TOOLS, executeTool, loadSkillText } from "./tools";

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type ToolResult = Anthropic.Beta.Messages.BetaToolResultBlockParam;

const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16_000;
// Tarefas devolvem o resultado inteiro numa chamada de ferramenta (ex.: um mês de pautas).
const MAX_TOKENS_TASK = 32_000;
const MAX_STEPS_PER_TURN = 30;
// Tarefas visuais renderizam e revisam várias artes (ex.: 7 slides × revisões).
const MAX_STEPS_TASK = 80;

let _client: Anthropic | null = null;
function client() {
  if (!ENV.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");
  _client ??= new Anthropic({ apiKey: ENV.anthropicApiKey });
  return _client;
}

// O prompt de sistema de cada agente é fixo (sem data nem dados do usuário),
// para que o prefixo tools + system fique em cache entre os turnos.
const PLATFORM_RULES = `Você é um agente interno da agência de marketing da Alle Energia, uma empresa brasileira de energia (Instagram: @alleenergia). Você trabalha para a equipe de marketing da Alle, que conversa com você nesta plataforma.

# Como você trabalha aqui

- Idioma: responda sempre em português do Brasil. Tudo o que for para o Instagram também sai em português, salvo pedido contrário.
- A skill abaixo foi escrita em inglês para criadores que falam por si mesmos. Aqui você trabalha para uma marca: "o usuário" é a equipe da Alle e a voz é a da Alle Energia. Adapte exemplos, números e referências (moeda em R$, público brasileiro, horários de Brasília).
- Memória: onde a skill fala em \`~/.claude/instagram/<arquivo>\` (voice.md, swipe.md, log.md, plan.md), use read_file e write_file com o nome do arquivo. Essa memória é compartilhada por todos os agentes da equipe, então mantenha-a organizada e atualizada. O arquivo estrategia.md tem as diretrizes estratégicas definidas pela equipe da Alle e o marca.md tem o retrato real da marca (voz, pilares, visual) feito pelo Agente de Marca: leia os dois antes de planejar ou criar qualquer peça e siga-os; só altere estrategia.md se a equipe pedir.
- Scripts: onde a skill manda rodar \`python3 <script>.py\`, use run_script. O humanizador e o detector usam um léxico de clichês em português (skills/ig-human/slop.pt.json). As demais heurísticas de idioma (detecção de CTA da legenda, fórmulas de gancho, contrações no detector) foram calibradas para inglês: em português, trate essas partes como aproximadas e use seu julgamento. Contagem de caracteres, corte de 125 caracteres, hashtags, links, emojis e tempo de fala valem normalmente.
- Outras skills: quando a skill mandar passar o texto por outra (ex.: /ig-human), carregue-a com load_skill e siga-a você mesmo. Arquivos de referência das skills podem ser lidos com read_file em "skills/<pasta>/<arquivo>" (ex.: skills/ig-reel/hooks.json).
- Dados reais: use get_brand_identity para a identidade da marca e as ferramentas do Instagram (get_instagram_account, get_instagram_posts, get_post_insights, view_image) para o perfil e os posts publicados. Prefira os dados reais da Alle a qualquer regra genérica. Se o Instagram não estiver conectado, diga isso e peça os dados colados.
- Artes: você cria peças visuais (posts, slides de carrossel, stories) desenhando em SVG e renderizando com render_design. Antes da primeira arte, carregue a skill alle-design com load_skill e siga-a. Onde a sua skill falar em montar arquivos em HTML ou imprimir slides, use render_design. Toda arte entregue passa pela revisão da alle-design (olhar o PNG e corrigir).
- Você não tem navegador. Quando a skill pedir para navegar ou pesquisar no Instagram, peça para o usuário colar as informações.
- Você nunca publica, agenda, comenta, curte nem envia mensagens: entrega o texto pronto para a equipe aprovar e publicar. Nunca invente números, clientes, depoimentos ou resultados; quando faltar um dado, deixe {{marcador}} e avise.
- Faça perguntas quando faltar algo essencial, todas de uma vez. Quando tiver o suficiente, entregue no formato de saída da skill.`;

const systemCache = new Map<string, string>();

async function systemPrompt(agent: AgentDefinition): Promise<string> {
  const cached = systemCache.get(agent.slug);
  if (cached) return cached;
  const skill = await loadSkillText(agent.skill);
  const prompt = `${PLATFORM_RULES}\n\n# Sua função: ${agent.name} (${agent.role})\n\nA skill que você segue está abaixo, na íntegra.\n\n${skill}`;
  systemCache.set(agent.slug, prompt);
  return prompt;
}

function submitTool(task: TaskDefinition): Anthropic.Beta.Messages.BetaTool {
  const { $schema: _, ...schema } = z.toJSONSchema(task.result, { io: "input" }) as Record<string, unknown>;
  return {
    name: "submit_result",
    description: "Registra o resultado final desta tarefa para a tela da plataforma exibir. Chame uma vez, no fim, com o resultado completo.",
    input_schema: schema as Anthropic.Beta.Messages.BetaTool["input_schema"],
  };
}

function hasText(content: Anthropic.Beta.Messages.BetaContentBlock[]) {
  return content.some((b) => b.type === "text" && b.text.trim().length > 0);
}

/**
 * Roda um turno completo do agente: chama o modelo, executa as ferramentas que
 * ele pedir e repete até ele terminar. Cada passo é gravado na thread, então a
 * tela acompanha o progresso. O histórico só cresce: os blocos voltam ao modelo
 * exatamente como vieram.
 */
export async function runTurn(userId: number, threadId: number) {
  const thread = await store.getThread(userId, threadId);
  if (!thread) return;
  const agent = getAgent(thread.agentSlug);
  try {
    if (!agent) throw new Error(`Agente desconhecido: ${thread.agentSlug}`);
    const system = await systemPrompt(agent);
    const task = thread.mode === "task" ? TASKS[thread.agentSlug] : undefined;
    if (thread.mode === "task" && !task) throw new Error(`O agente ${agent.name} não tem tarefa de tela.`);
    const tools = task ? [...AGENT_TOOLS, submitTool(task)] : AGENT_TOOLS;
    let delivered = Boolean(thread.result);
    const history = await store.listMessages(threadId);
    // Mensagens seguidas do mesmo papel (ex.: resultado de ferramenta gravado e
    // depois uma nova mensagem do usuário, após uma falha) viram uma só.
    const messages: MessageParam[] = [];
    for (const m of history) {
      const blocks = m.content as Exclude<MessageParam["content"], string>;
      const prev = messages[messages.length - 1];
      if (prev && prev.role === m.role) (prev.content as typeof blocks).push(...blocks);
      else messages.push({ role: m.role, content: [...blocks] });
    }

    const maxSteps = task ? MAX_STEPS_TASK : MAX_STEPS_PER_TURN;
    for (let step = 0; step < maxSteps; step++) {
      // Streaming: respostas longas (tarefas) passariam do tempo limite de uma chamada comum.
      const response = await client().beta.messages.stream({
        model: MODEL,
        max_tokens: task ? MAX_TOKENS_TASK : MAX_TOKENS,
        system,
        tools,
        messages,
        cache_control: { type: "ephemeral" },
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        // Se um classificador de segurança recusar por engano, a própria API
        // refaz o pedido num modelo de reserva.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      }).finalMessage();

      const toolUses = response.content.filter(
        (b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use"
      );
      const final = response.stop_reason !== "tool_use" || toolUses.length === 0;
      await store.addMessage(threadId, "assistant", response.content, {
        approval: !task && final && hasText(response.content) ? "pending" : null,
        usage: response.usage as unknown as Record<string, unknown>,
      });
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "refusal") throw new Error("O modelo recusou o pedido.");
      if (response.stop_reason === "max_tokens" && toolUses.length > 0) {
        throw new Error("A resposta passou do limite de tamanho no meio de uma ferramenta. Peça uma entrega menor.");
      }
      if (response.stop_reason === "pause_turn") continue;
      if (final) {
        if (task && !delivered) throw new Error("O agente terminou sem entregar o resultado. Rode de novo.");
        await store.setThreadStatus(threadId, "idle");
        return;
      }

      const results: ToolResult[] = await Promise.all(
        toolUses.map(async (tool) => {
          if (task && tool.name === "submit_result") {
            const parsed = task.result.safeParse(tool.input);
            if (!parsed.success) {
              return {
                type: "tool_result" as const, tool_use_id: tool.id, is_error: true,
                content: `Resultado fora do formato: ${parsed.error.issues.slice(0, 10).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`,
              };
            }
            await store.setThreadResult(threadId, parsed.data as Record<string, unknown>);
            delivered = true;
            return { type: "tool_result" as const, tool_use_id: tool.id, content: "Resultado registrado." };
          }
          const { content, isError } = await executeTool(userId, tool.name, tool.input);
          return { type: "tool_result", tool_use_id: tool.id, content, ...(isError ? { is_error: true } : {}) };
        })
      );
      await store.addMessage(threadId, "user", results);
      messages.push({ role: "user", content: results });
    }
    throw new Error(`O agente passou de ${maxSteps} passos neste turno e foi interrompido.`);
  } catch (error) {
    const message =
      error instanceof Anthropic.APIError ? `API do Claude (${error.status}): ${error.message}` : (error as Error).message;
    console.error(`[agents] thread ${threadId} falhou:`, error);
    await store.setThreadStatus(threadId, "failed", message);
  }
}

/** Grava a mensagem do usuário e dispara o turno em segundo plano. */
export async function sendUserMessage(userId: number, threadId: number, text: string) {
  const thread = await store.getThread(userId, threadId);
  if (!thread) throw new Error("Conversa não encontrada");
  if (thread.status === "running") throw new Error("O agente ainda está trabalhando nesta conversa.");
  // Se o turno anterior caiu entre um pedido de ferramenta e o resultado, a API
  // exige um tool_result para cada tool_use antes de qualquer outra coisa.
  const history = await store.listMessages(threadId);
  const last = history[history.length - 1];
  const pending = last?.role === "assistant"
    ? (last.content as Array<{ type: string; id?: string }>).filter((b) => b.type === "tool_use")
    : [];
  const interrupted: ToolResult[] = pending.map((b) => ({
    type: "tool_result", tool_use_id: b.id!, content: "Interrompido antes de executar.", is_error: true,
  }));
  await store.addMessage(threadId, "user", [...interrupted, { type: "text", text }]);
  await store.setThreadStatus(threadId, "running");
  void runTurn(userId, threadId);
}
