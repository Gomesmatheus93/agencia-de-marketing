import { getPostSchedulerTimeZone } from "./postScheduling";
import { fetchNewsFromSite, dedupeNewsItems, rankNewsItems, DEFAULT_NEWS_SITES } from "../routers";
import { sendNewsDigest, isWhatsAppConfigured } from "./whatsapp";
import { getAllEnabledDigestSettings, saveDigestSession, markDigestLastSent } from "../db";

const POLL_INTERVAL_MS = 60_000;

function getTodayDateString(timeZone: string) {
  return new Date().toLocaleDateString("pt-BR", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
}

function getCurrentHourMinute(timeZone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { hour, minute };
}

async function fetchTop5News() {
  const results = await Promise.allSettled(DEFAULT_NEWS_SITES.map(fetchNewsFromSite));
  const items = dedupeNewsItems(
    results.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
  );
  return rankNewsItems(items, "energia").slice(0, 5);
}

async function runDigestForUser(
  userId: number,
  whatsappNumber: string,
  top5: Awaited<ReturnType<typeof fetchTop5News>>
) {
  const newsItems = top5.map((item) => ({
    title: item.title,
    url: item.url,
    source: item.source,
    excerpt: item.excerpt ?? null,
    publishedAt: item.publishedAt ?? null,
  }));

  await saveDigestSession(userId, whatsappNumber, newsItems);
  const result = await sendNewsDigest(top5, whatsappNumber);
  if (result.error) {
    console.error(`[NewsDigest] user=${userId} falha no envio WA:`, result.error);
    return false;
  }
  console.log(`[NewsDigest] user=${userId} digest enviado. messageId=${result.messageId}`);
  return true;
}

async function runDigestTick() {
  const timeZone = getPostSchedulerTimeZone();
  const { hour, minute } = getCurrentHourMinute(timeZone);
  const today = getTodayDateString(timeZone);

  let users;
  try {
    users = await getAllEnabledDigestSettings();
  } catch (err) {
    console.error("[NewsDigest] Erro ao carregar configurações de usuários:", err);
    return;
  }

  const due = users.filter(
    (u) =>
      u.digestHour === hour &&
      u.digestMinute === minute &&
      u.lastSentDate !== today
  );

  if (due.length === 0) return;

  console.log(`[NewsDigest] ${due.length} usuário(s) com digest agendado agora (${hour}:${String(minute).padStart(2, "0")}).`);

  let top5: Awaited<ReturnType<typeof fetchTop5News>>;
  try {
    top5 = await fetchTop5News();
  } catch (err) {
    console.error("[NewsDigest] Erro ao buscar notícias:", err);
    return;
  }

  if (top5.length === 0) {
    console.warn("[NewsDigest] Nenhuma notícia encontrada, digest não enviado.");
    return;
  }

  for (const user of due) {
    try {
      const ok = await runDigestForUser(user.userId, user.whatsappNumber, top5);
      if (ok) {
        await markDigestLastSent(user.userId, today);
      }
    } catch (err) {
      console.error(`[NewsDigest] Erro ao enviar digest para user=${user.userId}:`, err);
    }
  }
}

export function startNewsDigestScheduler() {
  if (!isWhatsAppConfigured()) {
    console.log("[NewsDigest] WhatsApp não configurado — agendador de digest desativado.");
    return () => {};
  }

  const timeZone = getPostSchedulerTimeZone();
  console.log(`[NewsDigest] Agendador iniciado (timezone: ${timeZone}). Verificação a cada minuto.`);

  void runDigestTick();
  const interval = setInterval(() => { void runDigestTick(); }, POLL_INTERVAL_MS);

  return () => clearInterval(interval);
}