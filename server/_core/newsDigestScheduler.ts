import { getPostSchedulerTimeZone } from "./postScheduling";
import { fetchNewsFromSite, dedupeNewsItems, rankNewsItems, DEFAULT_NEWS_SITES } from "../routers";
import { sendNewsDigest } from "./whatsapp";
import { buildDigestTextMessage } from "./aggregatorWebhook";
import { getAllEnabledDigestSettings, saveDigestSession, markDigestLastSent } from "../db";
import { ENV } from "./env";

const POLL_INTERVAL_MS = 60_000;

// After GIVE_UP_AFTER_MINS minutes past the target, stop retrying for today
const GIVE_UP_AFTER_MINS = 30;

// Track per-user send attempts today (reset at midnight)
const attemptsToday = new Map<number, { date: string; tries: number }>();
const MAX_TRIES = 3;

function getTodayDateString(timeZone: string) {
  return new Date().toLocaleDateString("pt-BR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getCurrentMinutesFromMidnight(timeZone: string): { mins: number; today: string } {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const today = getTodayDateString(timeZone);
  return { mins: hour * 60 + minute, today };
}

function getUserAttempts(userId: number, today: string): number {
  const entry = attemptsToday.get(userId);
  if (!entry || entry.date !== today) return 0;
  return entry.tries;
}

function incrementAttempts(userId: number, today: string) {
  const prev = getUserAttempts(userId, today);
  attemptsToday.set(userId, { date: today, tries: prev + 1 });
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
  top5: Awaited<ReturnType<typeof fetchTop5News>>,
  templateName?: string,
  templateLanguage?: string
): Promise<boolean> {
  const newsItems = top5.map((item) => ({
    title: item.title,
    url: item.url,
    source: item.source,
    excerpt: item.excerpt ?? null,
    publishedAt: item.publishedAt ?? null,
  }));

  const messageText = buildDigestTextMessage(newsItems);
  await saveDigestSession(userId, whatsappNumber, newsItems, undefined, messageText);
  const result = await sendNewsDigest(top5, whatsappNumber, templateName, templateLanguage);

  if (result.error) {
    console.error(`[NewsDigest] user=${userId} falha no envio:`, result.error);
    return false;
  }

  console.log(`[NewsDigest] user=${userId} digest enviado. messageId=${result.messageId}`);
  return true;
}

const pad = (n: number) => String(n).padStart(2, "0");

async function runDigestTick() {
  const timeZone = getPostSchedulerTimeZone();
  const { mins: currentMins, today } = getCurrentMinutesFromMidnight(timeZone);
  const nowStr = `${pad(Math.floor(currentMins / 60))}:${pad(currentMins % 60)}`;

  let users;
  try {
    users = await getAllEnabledDigestSettings();
  } catch (err) {
    console.error("[NewsDigest] Erro ao carregar configurações:", err);
    return;
  }

  if (users.length === 0) return; // nenhum usuário configurado — sem log para não spamear

  // Log a reason for each user so we can debug in the console
  const due = users.filter((u) => {
    const targetMins = u.digestHour * 60 + u.digestMinute;
    const windowEnd = targetMins + GIVE_UP_AFTER_MINS;
    const targetStr = `${pad(u.digestHour)}:${pad(u.digestMinute)}`;

    if (u.lastSentDate === today) {
      // Only log once (at target time) to avoid console spam
      if (currentMins === targetMins) console.log(`[NewsDigest] ${nowStr} user=${u.userId} — já enviado hoje (${today}), pulando.`);
      return false;
    }
    if (currentMins < targetMins) {
      const minsLeft = targetMins - currentMins;
      if (minsLeft <= 5) console.log(`[NewsDigest] ${nowStr} user=${u.userId} — aguardando ${targetStr} (faltam ${minsLeft} min)`);
      return false;
    }
    if (currentMins >= windowEnd) {
      if (currentMins === windowEnd) console.warn(`[NewsDigest] ${nowStr} user=${u.userId} — janela ${targetStr} expirou sem envio.`);
      return false;
    }
    const tries = getUserAttempts(u.userId, today);
    if (tries >= MAX_TRIES) {
      console.warn(`[NewsDigest] ${nowStr} user=${u.userId} — limite de ${MAX_TRIES} tentativas atingido hoje.`);
      return false;
    }
    return true;
  });

  if (due.length === 0) return;

  console.log(
    `[NewsDigest] ${due.length} usuário(s) aguardando digest ` +
    `(${Math.floor(currentMins / 60)}:${String(currentMins % 60).padStart(2, "0")} ${timeZone})`
  );

  let top5: Awaited<ReturnType<typeof fetchTop5News>>;
  try {
    top5 = await fetchTop5News();
  } catch (err) {
    console.error("[NewsDigest] Erro ao buscar notícias:", err);
    return;
  }

  if (top5.length === 0) {
    console.warn("[NewsDigest] Nenhuma notícia encontrada — digest adiado para o próximo minuto.");
    return;
  }

  for (const user of due) {
    try {
      incrementAttempts(user.userId, today);
      const ok = await runDigestForUser(user.userId, user.whatsappNumber, top5, user.templateName, user.templateLanguage);
      if (ok) {
        await markDigestLastSent(user.userId, today);
      }
    } catch (err) {
      console.error(`[NewsDigest] Erro ao enviar para user=${user.userId}:`, err);
    }
  }
}

export function startNewsDigestScheduler() {
  // Only require API credentials (not the recipient number — each user has their own)
  if (!ENV.whatsappPhoneNumberId || !ENV.whatsappAccessToken) {
    console.log("[NewsDigest] WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_ACCESS_TOKEN não configurados — scheduler desativado.");
    return () => {};
  }

  const timeZone = getPostSchedulerTimeZone();
  console.log(`[NewsDigest] Scheduler iniciado (timezone: ${timeZone}, janela: até ${GIVE_UP_AFTER_MINS}min após o horário configurado).`);

  // Fire immediately on startup — catches up if server restarted during the send window
  void runDigestTick();
  const interval = setInterval(() => { void runDigestTick(); }, POLL_INTERVAL_MS);

  return () => clearInterval(interval);
}