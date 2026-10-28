import { z } from "zod";
import { DESIGN_MODEL_IDS, designModelById } from "../../shared/designModels";

// Tarefas: o modo em que um agente roda a partir de uma tela da plataforma
// (não do chat). A tela manda um `input`; o agente trabalha com as mesmas
// ferramentas e termina chamando `submit_result` com um JSON no formato
// `result`, que a tela desenha.

export type TaskDefinition<I extends z.ZodTypeAny = z.ZodTypeAny, R extends z.ZodTypeAny = z.ZodTypeAny> = {
  agentSlug: string;
  input: I;
  result: R;
  title: (input: z.infer<I>) => string;
  /** Mensagem que abre a tarefa (vai no histórico, não no prompt de sistema). */
  brief: (input: z.infer<I>) => string;
  /** Dados da conta anexados ao brief (ex.: a última auditoria para o planejamento). */
  context?: (userId: number) => Promise<string | null>;
};

const TASK_RULES = `Você está rodando como TAREFA disparada por uma tela da plataforma, não como conversa.
- Não faça perguntas: ninguém vai responder até você terminar. Quando faltar um dado, use a suposição mais razoável e registre-a em "assumptions".
- Trabalhe com as ferramentas e siga a sua skill no que couber.
- Termine OBRIGATORIAMENTE chamando a ferramenta submit_result com o resultado completo, em português. Se ela devolver erro de validação, corrija e chame de novo.
- Depois de registrar o resultado, responda só com uma frase curta dizendo que terminou.`;

// ─── Auditoria ────────────────────────────────────────────────────────────────

const auditInput = z.object({
  postCount: z.number().int().min(5).max(100).default(30),
  focus: z.string().trim().max(2000).optional(),
  pastedData: z.string().trim().max(50_000).optional(),
});

const auditResult = z.object({
  summary: z.string().describe("Resumo da auditoria em 2 a 4 frases, direto ao ponto."),
  period: z.string().describe("Período coberto, ex.: \"12/jun a 05/set/2026\"."),
  dataSource: z.enum(["instagram", "colado", "sem_dados"]),
  medianEngagement: z.number().describe("Mediana de engajamento (curtidas + comentários, + salvamentos e compartilhamentos quando houver) dos posts analisados."),
  posts: z.array(z.object({
    date: z.string().describe("YYYY-MM-DD"),
    format: z.enum(["reel", "carrossel", "imagem", "outro"]),
    theme: z.string().describe("Tema/pilar do post em poucas palavras."),
    hook: z.string().describe("A primeira linha da legenda ou o gancho."),
    likes: z.number(),
    comments: z.number(),
    reach: z.number().nullable(),
    saves: z.number().nullable(),
    shares: z.number().nullable(),
    engagement: z.number(),
    outlierMultiple: z.number().describe("engagement / medianEngagement, com 1 casa decimal."),
    permalink: z.string().nullable(),
    imageUrl: z.string().nullable(),
  })).max(100),
  findings: z.array(z.object({
    title: z.string().describe("A descoberta como afirmação."),
    evidence: z.string().describe("Os números que sustentam a afirmação."),
    confidence: z.enum(["alta", "média", "baixa"]),
  })).max(8),
  stop: z.array(z.string()).max(6).describe("O que parar de fazer."),
  doMore: z.array(z.string()).max(6).describe("O que fazer mais."),
  assumptions: z.array(z.string()),
});

export const auditTask: TaskDefinition<typeof auditInput, typeof auditResult> = {
  agentSlug: "auditoria",
  input: auditInput,
  result: auditResult,
  title: (i) => `Auditoria dos últimos ${i.postCount} posts`,
  brief: (i) => `${TASK_RULES}

TAREFA: auditoria do Instagram da Alle Energia.
- Leia os últimos ${i.postCount} posts com get_instagram_posts (limit ${i.postCount}). Se possível, leia as métricas (get_post_insights) dos posts que parecerem os melhores e os piores; se a permissão de insights falhar, siga só com curtidas e comentários.
- Engajamento de cada post = curtidas + comentários (+ salvamentos + compartilhamentos quando houver). outlierMultiple = engajamento ÷ mediana dos posts analisados.
- Inclua em "posts" todos os posts analisados (não só os melhores).
- Siga a skill para achar o padrão: formato, tema, gancho, horário (por último). Diga a confiança de cada descoberta conforme o tamanho da amostra.
- Se ainda não existir voice.md na memória, escreva-o a partir das legendas reais (modelo em skills/voice.template.md). Se existir, atualize só o que a auditoria mostrar de novo.
- Registre a conclusão em log.md (acrescente uma linha com a data e o resumo).
${i.pastedData ? `\nDADOS COLADOS PELA EQUIPE (use se o Instagram não estiver conectado):\n${i.pastedData}\n` : "- Se o Instagram não estiver conectado, entregue com dataSource \"sem_dados\", posts vazio e explique em summary como conectar."}
${i.focus ? `\nFOCO PEDIDO PELA EQUIPE: ${i.focus}` : ""}`,
};

// ─── Planejamento ─────────────────────────────────────────────────────────────

const planInput = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.enum(["semana", "mes"]).default("semana"),
  postsPerWeek: z.number().int().min(1).max(14).default(5),
  goal: z.enum(["vendas", "equilibrado", "alcance", "engajamento"]).default("vendas"),
  notes: z.string().trim().max(5000).optional(),
});

// Foco do período escolhido na tela. A estratégia permanente fica em estrategia.md.
const PLAN_GOALS = {
  vendas: "VENDAS. A maioria das pautas tem intenção comercial clara. Varie a forma de vender: oferta direta (o que é, como contratar), prova (caso real, depoimento, antes e depois), quebra de objeção, comparação e educação que termina na oferta. Nunca duas ofertas secas seguidas. Todo post termina com um CTA comercial único.",
  equilibrado: "EQUILIBRADO. Metade das pautas vende (oferta, prova, objeção) e metade constrói confiança e alcance (educação, opinião, bastidores), sempre com CTA.",
  engajamento: "ENGAJAMENTO. O objetivo é aumentar comentários, salvamentos, compartilhamentos e conversas (é o que a auditoria mede e o que destrava o alcance). Ataque os pontos fracos que a auditoria e a análise de marca apontaram e repita o que funcionou nelas (formato, tema, tipo de gancho). Cada pauta precisa de um motivo concreto para interagir: pergunta específica, palavra-chave para comentar, conteúdo salvável (lista, passo a passo, comparação), algo para mandar a alguém. Stories diários com enquete ou caixa de perguntas. Responder os comentários na primeira hora faz parte do plano. Mantenha 1 ou 2 pautas comerciais, com o CTA também pedindo interação.",
  alcance: "ALCANCE E AUTORIDADE. Prioridade é chegar em quem ainda não segue a Alle (Reels educativos e de opinião), com 1 ou 2 pautas comerciais no período para não perder a venda.",
} as const;

const planResult = z.object({
  periodLabel: z.string().describe("Ex.: \"Semana de 26/out a 01/nov/2026\"."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  strategy: z.string().describe("A lógica do plano em 2 a 4 frases: o que ele prioriza e por quê, com base nos dados."),
  pillars: z.array(z.object({ name: z.string(), share: z.number().describe("Porcentagem 0-100.") })).max(8),
  items: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/).describe("Horário de Brasília, HH:MM."),
    format: z.enum(["reel", "carrossel", "imagem", "stories"]),
    type: z.string().describe("Tipo de post da skill: Prova, Ensino, Opinião, História, Oferta…"),
    title: z.string().describe("Título curto da pauta."),
    angle: z.string().describe("O ângulo específico, não só o tema."),
    hook: z.string().describe("O gancho/primeira linha sugerido."),
    captionIdea: z.string().describe("Direção da legenda em 1 a 3 frases."),
    collab: z.string().nullable().describe("@ do parceiro se for collab, senão null."),
    addresses: z.string().nullable().describe("Qual ponto da auditoria ou da análise de marca esta pauta melhora ou repete (ex.: \"auditoria: reels com gente real tiveram 4,8x a mediana\"). null se nenhum."),
    notes: z.string().nullable(),
  })).max(60),
  stories: z.string().describe("Orientação dos stories do período."),
  engagement: z.array(z.object({
    handle: z.string(),
    reason: z.string(),
    group: z.enum(["alcance", "pares", "compradores"]),
  })).max(10),
  assumptions: z.array(z.string()),
});

/** Resumo da última auditoria e da última análise de marca da conta, para o planejamento. */
export async function planContext(userId: number): Promise<string | null> {
  const { latestTaskResult } = await import("./store");
  const [audit, brand] = await Promise.all([latestTaskResult(userId, "auditoria"), latestTaskResult(userId, "marca")]);
  const parts: string[] = [];
  if (audit) {
    const r = audit.result as Record<string, any>;
    const ranked = [...(r.posts ?? [])].sort((a: any, b: any) => b.outlierMultiple - a.outlierMultiple);
    const line = (p: any) => `${p.date} · ${p.format} · ${p.theme} · ${p.outlierMultiple}x · "${String(p.hook).slice(0, 90)}"`;
    parts.push([
      `ÚLTIMA AUDITORIA (${audit.date}, ${r.period}, ${(r.posts ?? []).length} posts, mediana de engajamento ${r.medianEngagement}):`,
      `Resumo: ${r.summary}`,
      ...(r.findings ?? []).map((f: any) => `- Descoberta (${f.confidence}): ${f.title} — ${f.evidence}`),
      r.stop?.length ? `Parar: ${r.stop.join(" | ")}` : "",
      r.doMore?.length ? `Fazer mais: ${r.doMore.join(" | ")}` : "",
      ranked.length ? `Melhores posts:\n${ranked.slice(0, 5).map(line).join("\n")}` : "",
      ranked.length > 5 ? `Piores posts:\n${ranked.slice(-3).map(line).join("\n")}` : "",
    ].filter(Boolean).join("\n"));
  }
  if (brand) {
    const r = brand.result as Record<string, any>;
    const off = (r.checks ?? []).flatMap((c: any) => c.offBrand ?? []);
    parts.push([
      `ÚLTIMA ANÁLISE DE MARCA (${brand.date}, modo ${r.mode}${r.overallScore != null ? `, nota ${Math.round(r.overallScore)}/100` : ""}, fonte ${r.dataSource}):`,
      `Resumo: ${r.summary}`,
      off.length ? `Desvios encontrados: ${[...new Set(off)].slice(0, 10).join(" | ")}` : "",
      r.profile?.strategyGaps?.length ? `Diferenças entre feed e estratégia: ${r.profile.strategyGaps.join(" | ")}` : "",
      r.recommendations?.length ? `Recomendações: ${r.recommendations.join(" | ")}` : "",
    ].filter(Boolean).join("\n"));
  }
  return parts.length ? parts.join("\n\n") : null;
}

export const planTask: TaskDefinition<typeof planInput, typeof planResult> = {
  agentSlug: "planejamento",
  context: planContext,
  input: planInput,
  result: planResult,
  title: (i) => `Plano ${i.period === "mes" ? "do mês" : "da semana"} a partir de ${i.startDate.split("-").reverse().join("/")} · foco ${i.goal}`,
  brief: (i) => `${TASK_RULES}

TAREFA: planejamento de postagens do Instagram da Alle Energia.
- Período: ${i.period === "mes" ? `o mês inteiro que começa em ${i.startDate}` : `7 dias a partir de ${i.startDate}`}. Frequência: ${i.postsPerWeek} posts por semana no feed (stories à parte).
- FOCO DESTE PERÍODO: ${PLAN_GOALS[i.goal]}
- Se houver DADOS DA CONTA abaixo (última auditoria e análise de marca), o plano se baseia neles: cada pauta deve atacar um ponto a melhorar ou repetir o que funcionou, indicado em "addresses". Explique essa lógica em "strategy".
- Antes de planejar, leia a memória: estrategia.md (diretrizes da equipe, obrigatório seguir) e voice.md, swipe.md, log.md, plan.md (os que existirem), além da identidade da marca. Se o Instagram estiver conectado, olhe os posts recentes para manter a linha e não repetir temas recentes.
- Cada item precisa de um ângulo específico, não só um tema. Não repita o mesmo formato em dias seguidos. Use horários de Brasília pensando no público da Alle.
- Considere datas comemorativas e sazonais do período no Brasil quando fizer sentido para a marca.
- Grave o plano em plan.md (substitua o anterior) para os outros agentes lerem.
${i.notes ? `\nOBSERVAÇÕES DA EQUIPE (obrigatório respeitar):\n${i.notes}` : ""}`,
};

// ─── Carrossel (texto + artes) ────────────────────────────────────────────────

const artUrl = z.string().regex(/^(https?:\/\/|\/uploads\/)\S+$/, "Use a URL devolvida por render_design (ARTE_URL).");

const designModel = z.enum(DESIGN_MODEL_IDS as [string, ...string[]]).optional();

/** Linha do brief sobre o modelo visual da biblioteca de referências. */
function modelLine(id: string | undefined) {
  const m = designModelById(id);
  if (!m) return "- Modelo visual: leia skills/alle-design/referencias.md e escolha você o modelo que combina com a pauta (diga qual usou em \"assumptions\").";
  return `- Modelo visual OBRIGATÓRIO: ${m.id} · ${m.name} (${m.summary}). Leia a descrição completa do ${m.id} em skills/alle-design/referencias.md e siga a estrutura dele${m.id === "M07" ? " em todos os slides" : ""}. Se o estilo de cor pedido conflitar com o modelo, o modelo manda. Registre em "assumptions" que usou o ${m.id}.`;
}

const carouselInput = z.object({
  topic: z.string().trim().min(3).max(3000),
  slides: z.number().int().min(5).max(10).default(7),
  style: z.enum(["auto", "roxo", "laranja", "claro"]).default("auto"),
  model: designModel,
  notes: z.string().trim().max(3000).optional(),
});

const carouselResult = z.object({
  title: z.string(),
  slides: z.array(z.object({
    role: z.enum(["capa", "contexto", "conteudo", "resumo", "cta"]),
    heading: z.string(),
    body: z.string(),
    imageUrl: artUrl,
  })).min(5).max(10),
  caption: z.string().describe("Legenda final (Job B da ig-caption), já humanizada."),
  altText: z.string().describe("Texto alternativo da capa."),
  hashtags: z.array(z.string()).max(5),
  assumptions: z.array(z.string()),
});

export const carouselTask: TaskDefinition<typeof carouselInput, typeof carouselResult> = {
  agentSlug: "carrossel",
  input: carouselInput,
  result: carouselResult,
  title: (i) => `Carrossel: ${i.topic.split("\n")[0].slice(0, 60)}`,
  brief: (i) => `${TASK_RULES}

TAREFA: criar um carrossel completo para o Instagram da Alle Energia, com as artes prontas.
- Pauta: ${i.topic}
- ${i.slides} slides, formato feed_4x5. Estilo visual: ${i.style === "auto" ? "escolha você entre roxo, laranja e claro, alternando com ritmo" : `predominantemente ${i.style}`}.
${modelLine(i.model)}
- Leia a memória (voice.md, plan.md) e a identidade da marca antes de escrever.
- Escreva o texto seguindo a sua skill (capa de até 6 palavras, uma ideia por slide, slide de resumo, CTA único). Passe o texto pela skill ig-human (run_script humanize/detect).
- Carregue a skill alle-design e desenhe cada slide com render_design, revisando cada PNG. Mantenha a unidade visual entre os slides.
- Escreva a legenda pela skill ig-caption (Job B) e confira com run_script caption.
- Em "slides", use em imageUrl exatamente a ARTE_URL de cada slide, na ordem.
${i.notes ? `\nOBSERVAÇÕES DA EQUIPE: ${i.notes}` : ""}`,
};

// ─── Post (arte + legenda) ────────────────────────────────────────────────────

const postInput = z.object({
  topic: z.string().trim().min(3).max(3000),
  format: z.enum(["feed_4x5", "feed_1x1", "story_9x16"]).default("feed_4x5"),
  model: designModel,
  notes: z.string().trim().max(3000).optional(),
});

const postResult = z.object({
  title: z.string(),
  imageUrl: artUrl,
  caption: z.string().describe("Legenda final, já humanizada e conferida com o linter."),
  firstComment: z.string().nullable().describe("Primeiro comentário, se houver link ou informação extra."),
  altText: z.string(),
  hashtags: z.array(z.string()).max(5),
  linterVerdict: z.enum(["READY", "REVIEW", "FIX"]).describe("Veredito do run_script caption na versão final."),
  assumptions: z.array(z.string()),
});

export const postTask: TaskDefinition<typeof postInput, typeof postResult> = {
  agentSlug: "legendas",
  input: postInput,
  result: postResult,
  title: (i) => `Post: ${i.topic.split("\n")[0].slice(0, 60)}`,
  brief: (i) => `${TASK_RULES}

TAREFA: criar um post completo (arte + legenda) para o Instagram da Alle Energia.
- Pauta: ${i.topic}
- Formato da arte: ${i.format}.
${modelLine(i.model)}
- Leia a memória (voice.md, plan.md) e a identidade da marca.
- Escreva a legenda pela sua skill (decida Job A ou B), humanize (ig-human) e confira com run_script caption até chegar a READY ou a um REVIEW justificado.
- Carregue a skill alle-design e desenhe a arte com render_design (o texto da arte é curto: o gancho, não a legenda). Revise o PNG.
- Em imageUrl, use exatamente a ARTE_URL da versão final.
${i.notes ? `\nOBSERVAÇÕES DA EQUIPE: ${i.notes}` : ""}`,
};

// ─── Stories (sequência do dia, com artes) ────────────────────────────────────

const storiesInput = z.object({
  topic: z.string().trim().min(3).max(3000),
  frames: z.number().int().min(3).max(7).default(5),
  notes: z.string().trim().max(3000).optional(),
});

// Área onde a figurinha entra no app (a arte deixa esse espaço livre).
export const STORY_STICKER_ZONE = { top: 1150, bottom: 1480 };

const storiesResult = z.object({
  title: z.string(),
  goal: z.string().describe("O objetivo da sequência em uma frase (ex.: puxar conversa no Direct sobre a conta de luz)."),
  frames: z.array(z.object({
    role: z.enum(["abertura", "meio", "pergunta", "fechamento"]),
    imageUrl: artUrl,
    onScreen: z.string().describe("O texto que está na arte."),
    voiceover: z.string().nullable().describe("O que falar, se o quadro for gravado em vídeo; null se for só imagem."),
    sticker: z.object({
      type: z.enum(["nenhum", "enquete", "caixa_de_perguntas", "quiz", "slider", "link", "contagem"]),
      prompt: z.string().nullable().describe("O texto da figurinha (pergunta, título)."),
      options: z.array(z.string()).max(4).describe("Opções da enquete/quiz; vazio para os outros tipos."),
    }),
    replaceWithRealMedia: z.boolean().describe("true quando o ideal é a equipe trocar a arte por foto/vídeo real (rosto ou mão)."),
    notes: z.string().nullable(),
  })).min(3).max(7),
  followUp: z.string().describe("O que fazer com as respostas (a quem responder no Direct e como)."),
  assumptions: z.array(z.string()),
});

export const storiesTask: TaskDefinition<typeof storiesInput, typeof storiesResult> = {
  agentSlug: "stories",
  input: storiesInput,
  result: storiesResult,
  title: (i) => `Stories: ${i.topic.split("\n")[0].slice(0, 60)}`,
  brief: (i) => `${TASK_RULES}

TAREFA: criar a sequência de stories do dia da Alle Energia, com as artes prontas.
- Tema: ${i.topic}
- ${i.frames} quadros, seguindo a sua skill (abertura, conteúdo, pergunta com UMA figurinha no 4º quadro ou antes, fechamento). Fale com "você", uma ideia por quadro.
- Leia a memória (voice.md, plan.md) e a identidade da marca. Humanize os textos (ig-human).
- Carregue a skill alle-design e desenhe cada quadro com render_design no formato story_9x16 (texto entre y=250 e y=1600). Na abertura, prefira foto de pessoa ou mão (search_photos) e marque replaceWithRealMedia=true quando o ideal for a equipe gravar a cena real.
- Figurinhas interativas são colocadas no app do Instagram: NÃO desenhe a figurinha. No quadro com figurinha, deixe livre a faixa de y=${STORY_STICKER_ZONE.top} a y=${STORY_STICKER_ZONE.bottom} (nada de texto ou elemento importante ali) e descreva a figurinha em "sticker".
- Em imageUrl, use exatamente a ARTE_URL de cada quadro, na ordem.
${i.notes ? `\nOBSERVAÇÕES DA EQUIPE: ${i.notes}` : ""}`,
};

// ─── Marca (estudar / conferir o padrão) ──────────────────────────────────────

const brandInput = z.object({
  mode: z.enum(["estudar", "conferir"]),
  postCount: z.number().int().min(5).max(50).default(20),
  focus: z.string().trim().max(2000).optional(),
});

const brandResult = z.object({
  mode: z.enum(["estudar", "conferir"]),
  summary: z.string().describe("O essencial em 2 a 4 frases."),
  dataSource: z.enum(["instagram", "perfil_publico", "sem_dados"]),
  confidence: z.enum(["alta", "média", "baixa"]),
  profile: z.object({
    offer: z.string().describe("O que a Alle vende e para quem, como aparece nos posts."),
    tone: z.string(),
    voiceExamples: z.array(z.string()).max(3).describe("Trechos reais de legendas que soam mais 'Alle'."),
    pillars: z.array(z.object({ name: z.string(), share: z.number() })).max(8),
    captionPattern: z.string(),
    ctas: z.array(z.string()).max(6),
    palette: z.array(z.object({ hex: z.string(), role: z.string() })).max(8),
    typography: z.string(),
    layouts: z.string(),
    photoStyle: z.string(),
    logoUsage: z.string(),
    cadence: z.string().describe("Formatos, frequência, dias e horários típicos."),
    strategyGaps: z.array(z.string()).describe("Onde o que é publicado diverge de estrategia.md."),
  }).nullable().describe("Preencha no modo estudar; null no modo conferir."),
  overallScore: z.number().min(0).max(100).nullable().describe("Nota média de aderência no modo conferir; null no modo estudar."),
  checks: z.array(z.object({
    date: z.string(),
    format: z.string(),
    hook: z.string(),
    permalink: z.string().nullable(),
    imageUrl: z.string().nullable(),
    score: z.number().min(0).max(100),
    scores: z.object({ estrategia: z.number(), voz: z.number(), visual: z.number().nullable(), execucao: z.number() }),
    onBrand: z.array(z.string()).max(4),
    offBrand: z.array(z.string()).max(5),
    fix: z.string().nullable(),
  })).max(50).describe("Um item por post no modo conferir; vazio no modo estudar."),
  recommendations: z.array(z.string()).max(6),
  assumptions: z.array(z.string()),
});

export const brandTask: TaskDefinition<typeof brandInput, typeof brandResult> = {
  agentSlug: "marca",
  input: brandInput,
  result: brandResult,
  title: (i) => (i.mode === "estudar" ? `Estudo da marca (${i.postCount} posts)` : `Conferência do padrão (${i.postCount} posts)`),
  brief: (i) => `${TASK_RULES}

TAREFA: ${i.mode === "estudar" ? "ESTUDAR a marca Alle Energia" : "CONFERIR se os posts da Alle Energia seguem o padrão"}, seguindo a sua skill (modo ${i.mode.toUpperCase()}).
- Leia estrategia.md, marca.md e voice.md (os que existirem) e a identidade da marca.
- Analise os últimos ${i.postCount} posts. Se o Instagram estiver conectado, use get_instagram_posts e olhe as imagens com view_image. Se não estiver, tente scan_public_instagram com o @ da marca; se também falhar, entregue com dataSource "sem_dados", confiança baixa e explique em summary que é preciso conectar o Instagram.
${i.mode === "estudar"
    ? "- Grave o retrato completo em marca.md (substitua o anterior) e preencha \"profile\". \"checks\" fica vazio e overallScore null."
    : "- Dê a nota de cada post pela tabela da skill e preencha \"checks\" (imageUrl e permalink do post quando houver) e overallScore. \"profile\" fica null. Registre a conferência em log.md."}
${i.focus ? `\nPEDIDO DA EQUIPE: ${i.focus}` : ""}`,
};

export const TASKS: Record<string, TaskDefinition> = {
  [auditTask.agentSlug]: auditTask,
  [planTask.agentSlug]: planTask,
  [carouselTask.agentSlug]: carouselTask,
  [postTask.agentSlug]: postTask,
  [storiesTask.agentSlug]: storiesTask,
  [brandTask.agentSlug]: brandTask,
};

export type AuditResult = z.infer<typeof auditResult>;
export type PlanResult = z.infer<typeof planResult>;
/** Uma pauta do plano (para edição manual na tela). */
export const planItemSchema = planResult.shape.items.element;
export type CarouselResult = z.infer<typeof carouselResult>;
export type PostResult = z.infer<typeof postResult>;
export type StoriesResult = z.infer<typeof storiesResult>;
export type BrandResult = z.infer<typeof brandResult>;
