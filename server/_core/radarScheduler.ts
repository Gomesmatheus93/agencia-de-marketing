import { ENV } from "./env";
import { invokeLLM } from "./llm";
import {
  upsertTrendingTopic,
  updateTopicClassification,
  getPendingTopicsForClassification,
  getUsersWithNiches,
  upsertUserTopicAngle,
} from "../db";

const POLL_INTERVAL_MS = 60_000;
const TIME_ZONE = "America/Fortaleza";

// Runs at 08:00 and 14:00 Fortaleza time
const RUN_MINUTES = [8 * 60, 14 * 60];

const ranToday = new Set<string>(); // "<date>-<minute>"

function getNow(): { mins: number; today: string } {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: TIME_ZONE });
  return { mins: hour * 60 + minute, today };
}

// ─── Step 1a: Collect trending news via Serper ────────────────────────────────

interface SerperResult {
  title: string;
  snippet?: string;
  link?: string;
  date?: string;
}

async function collectViaSerper(): Promise<boolean> {
  const queries = [
    "tendências marketing digital 2025",
    "viral redes sociais brasil",
    "novidades Instagram TikTok negócios",
    "empreendedorismo tendência semana",
  ];

  let inserted = 0;
  for (const q of queries) {
    try {
      const resp = await fetch("https://google.serper.dev/news", {
        method: "POST",
        headers: {
          "X-API-KEY": ENV.serperApiKey!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q, gl: "br", hl: "pt-br", num: 10 }),
      });

      if (!resp.ok) {
        console.warn(`[Radar] Serper retornou ${resp.status} para query "${q}"`);
        continue;
      }

      const data = (await resp.json()) as { news?: SerperResult[] };
      const items = data.news ?? [];

      for (const item of items) {
        if (!item.title || item.title.length < 10) continue;

        const externalId = Buffer.from(item.title.slice(0, 64)).toString("base64url");
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        await upsertTrendingTopic({
          externalId,
          title: item.title,
          description: item.snippet,
          source: "serper",
          sourceUrl: item.link,
          expiresAt,
        });
        inserted++;
      }
    } catch (err) {
      console.error(`[Radar] Erro ao coletar query "${q}":`, err);
    }
  }
  return inserted > 0;
}

// ─── Step 1b: Fallback — generate topics via LLM when Serper is unavailable ───

async function collectViaLLM(): Promise<number> {
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "Você é um especialista em marketing digital no Brasil. Responda APENAS com JSON válido, sem texto adicional.",
      },
      {
        role: "user",
        content: `Hoje é ${today}. Gere exatamente 12 temas em alta para marketing digital, redes sociais e empreendedorismo no Brasil.

Retorne um objeto JSON com a chave "topics" contendo um array de 12 objetos, cada um com:
- title: string (título chamativo, máx 100 chars)
- description: string (frase de contexto, máx 200 chars)
- viralScore: number (0-100)
- emotionalAngle: "curiosidade" | "medo" | "aspiracao" | "polemica"
- relevanceWindow: "ephemeral" | "weekly" | "evergreen"
- niches: string[] (2-5 nichos: "marketing", "ecommerce", "fitness", "educacao", "financas", "tecnologia", "moda", etc.)

Exemplo de formato:
{"topics":[{"title":"Como o algoritmo do Instagram mudou em 2025","description":"Nova atualização prioriza conteúdo original e reduz alcance de reposts","viralScore":85,"emotionalAngle":"curiosidade","relevanceWindow":"weekly","niches":["marketing","ecommerce"]}]}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1500,
  });

  const rawContent = typeof result.choices[0]?.message?.content === "string"
    ? result.choices[0].message.content
    : "{}";
  console.log("[Radar] LLM raw response (first 200 chars):", rawContent.slice(0, 200));

  let topics: Array<{
    title: string; description: string; viralScore: number;
    emotionalAngle: string; relevanceWindow: string; niches: string[];
  }> = [];

  try {
    const parsed = JSON.parse(rawContent) as { topics?: typeof topics };
    topics = Array.isArray(parsed.topics) ? parsed.topics : [];
  } catch (parseErr) {
    console.error("[Radar] Falha ao fazer parse do JSON:", parseErr);
    return 0;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  let inserted = 0;
  for (const t of topics) {
    if (!t.title || t.title.length < 5) continue;
    // Use title hash so same topic doesn't get duplicated across runs
    const externalId = `llm-${Buffer.from(t.title.slice(0, 60)).toString("base64url")}`;
    const id = await upsertTrendingTopic({
      externalId,
      title: t.title.slice(0, 512),
      description: t.description?.slice(0, 500),
      source: "llm",
      expiresAt,
    });
    if (id) {
      await updateTopicClassification(id, {
        viralScore: Math.max(0, Math.min(100, Number(t.viralScore) || 50)),
        emotionalAngle: ["curiosidade","medo","aspiracao","polemica"].includes(t.emotionalAngle) ? t.emotionalAngle : "curiosidade",
        relevanceWindow: ["ephemeral","weekly","evergreen"].includes(t.relevanceWindow) ? t.relevanceWindow : "weekly",
        niches: (Array.isArray(t.niches) ? t.niches : []).slice(0, 8),
      });
      inserted++;
    }
  }
  console.log(`[Radar] LLM gerou e classificou ${inserted} temas.`);
  return inserted;
}

// ─── Step 1: Collect trending topics (Serper preferred, LLM as fallback) ──────

async function collectTrendingTopics(): Promise<number> {
  if (ENV.serperApiKey) {
    const ok = await collectViaSerper();
    if (ok) return 1;
    console.warn("[Radar] Serper não retornou temas — usando fallback LLM.");
  } else {
    console.log("[Radar] SERPER_API_KEY não configurado — gerando temas via LLM.");
  }
  return collectViaLLM();
}

// ─── Step 2: Classify topics via LLM (batch) ─────────────────────────────────

interface ClassificationResult {
  viralScore: number;
  emotionalAngle: "curiosidade" | "medo" | "aspiracao" | "polemica";
  relevanceWindow: "ephemeral" | "weekly" | "evergreen";
  niches: string[];
}

async function classifyPendingTopics(): Promise<void> {
  const pending = await getPendingTopicsForClassification();
  if (pending.length === 0) return;

  const topicList = pending
    .map((t) => `ID ${t.id}: "${t.title}"${t.description ? ` — ${t.description.slice(0, 120)}` : ""}`)
    .join("\n");

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Você é especialista em marketing digital e análise de tendências no Brasil. Responda APENAS com JSON válido, sem texto adicional.",
        },
        {
          role: "user",
          content: `Classifique cada tema abaixo para uso em conteúdo de redes sociais.

Para cada tema retorne:
- id: o ID numérico do tema (exatamente como fornecido)
- viralScore: potencial viral de 0 a 100
- emotionalAngle: "curiosidade", "medo", "aspiracao" ou "polemica"
- relevanceWindow: "ephemeral" (< 24h), "weekly" (< 7 dias), "evergreen" (atemporal)
- niches: lista de nichos relevantes (ex: "marketing", "ecommerce", "saude", "fitness", "educacao", "financas", "tecnologia", "moda")

Retorne um objeto JSON com a chave "topics" contendo um array com as classificações.
Exemplo: {"topics":[{"id":1,"viralScore":75,"emotionalAngle":"curiosidade","relevanceWindow":"weekly","niches":["marketing","ecommerce"]}]}

Temas:
${topicList}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const rawContent = result.choices[0]?.message?.content;
    const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : "{}") as { topics: Array<{ id: number } & ClassificationResult> };
    for (const item of parsed.topics ?? []) {
      if (!item.id || !item.niches?.length) continue;
      await updateTopicClassification(item.id, {
        viralScore: Math.max(0, Math.min(100, item.viralScore ?? 50)),
        emotionalAngle: item.emotionalAngle ?? "curiosidade",
        relevanceWindow: item.relevanceWindow ?? "weekly",
        niches: item.niches.slice(0, 8),
      });
    }
  } catch (err) {
    console.error("[Radar] Erro ao classificar tópicos:", err);
  }
}

// ─── Step 3: Personalize angles per user ─────────────────────────────────────

async function personalizeForUsers(): Promise<void> {
  const { getActiveTopics } = await import("../db");
  const [userList, activeTopics] = await Promise.all([
    getUsersWithNiches(),
    getActiveTopics(),
  ]);

  if (activeTopics.length === 0 || userList.length === 0) return;

  for (const user of userList) {
    const userNiche = user.nicheId ?? user.subNicheId;

    // Pick topics relevant to this user's niche (or top topics if no niche set)
    const relevant = userNiche
      ? activeTopics.filter((t) => {
          const niches = Array.isArray(t.niches) ? (t.niches as string[]) : [];
          return niches.some(
            (n) => userNiche.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(userNiche.toLowerCase())
          );
        })
      : activeTopics;

    const candidates = (relevant.length > 0 ? relevant : activeTopics).slice(0, 5);
    if (candidates.length === 0) continue;

    const topicList = candidates
      .map((t) => `ID ${t.id}: "${t.title}"`)
      .join("\n");

    const nicheContext = userNiche
      ? `O usuário atua no nicho: "${userNiche}".`
      : "O usuário não definiu nicho — use uma abordagem genérica de marketing digital.";

    try {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Você é um estrategista de conteúdo para redes sociais no Brasil. Responda APENAS com JSON válido, sem texto adicional.",
          },
          {
            role: "user",
            content: `${nicheContext}

Para cada tema abaixo, crie um ângulo de conteúdo personalizado para este usuário:
- topicId: o ID numérico do tema (exatamente como fornecido)
- suggestedTitle: título chamativo (máx 80 caracteres) para post no Instagram/LinkedIn
- suggestedHook: gancho de abertura (máx 150 caracteres) que prende a atenção

Retorne um objeto JSON com a chave "angles" contendo um array.
Exemplo: {"angles":[{"topicId":1,"suggestedTitle":"Título aqui","suggestedHook":"Gancho aqui"}]}

Temas:
${topicList}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 600,
      });

      const rawContent = result.choices[0]?.message?.content;
      const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : "{}") as { angles: Array<{ topicId: number; suggestedTitle: string; suggestedHook: string }> };
      for (const angle of parsed.angles ?? []) {
        if (!angle.topicId || !angle.suggestedTitle) continue;
        await upsertUserTopicAngle({
          userId: user.id,
          trendingTopicId: angle.topicId,
          suggestedTitle: angle.suggestedTitle.slice(0, 512),
          suggestedHook: angle.suggestedHook?.slice(0, 500) ?? "",
        });
      }
    } catch (err) {
      console.error(`[Radar] Erro ao personalizar ângulos para userId=${user.id}:`, err);
    }
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function runRadarPipeline(): Promise<{ inserted: number }> {
  console.log("[Radar] Iniciando pipeline de temas em alta...");
  const inserted = await collectTrendingTopics();
  await classifyPendingTopics();
  await personalizeForUsers();
  console.log(`[Radar] Pipeline concluído. Temas inseridos: ${inserted}`);
  return { inserted };
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

export function startRadarScheduler(): void {
  setInterval(async () => {
    const { mins, today } = getNow();

    for (const targetMins of RUN_MINUTES) {
      if (mins >= targetMins && mins < targetMins + 5) {
        const key = `${today}-${targetMins}`;
        if (!ranToday.has(key)) {
          ranToday.add(key);
          // Clean old keys to avoid memory leak
          if (ranToday.size > 10) {
            const [first] = ranToday;
            ranToday.delete(first);
          }
          void runRadarPipeline();
        }
      }
    }
  }, POLL_INTERVAL_MS).unref();

  console.log("[Radar] Scheduler iniciado — rodará às 08:00 e 14:00 (America/Fortaleza).");
}

// Export for admin manual trigger
export { runRadarPipeline };
