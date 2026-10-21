import { eq, desc, asc, and, or, isNull, lte, sql, count, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { SQL } from "drizzle-orm";
import postgres from "postgres";
import { nanoid } from "nanoid";
import { hashPassword } from "./_core/password";
import { blindIndex, decryptField, encryptField } from "./_core/crypto";

// Id da linha recém-inserida, lido do RETURNING. Aceita a linha, a lista de
// linhas ou o par [linhas, meta] devolvido por execute().
function insertId(result: unknown): number {
  let row: unknown = result;
  while (Array.isArray(row)) row = row[0];
  return Number((row as { id: number | string }).id);
}
import {
  InsertUser,
  users,
  dailyUsage,
  chatConversations,
  chatMessages,
  generatedImages,
  articles,
  carousels,
  carouselTemplates,
  avatarVideos,
  socialPosts,
  instagramConnections,
  canvaConnections,
  linkedinConnections,
  featureFlags,
  postMetrics,
  templatePerformance,
  editorialPlanItems,
  instagramAccountInsightsDaily,
  type ChatConversation,
  type ChatMessage,
  type GeneratedImage,
  type Article,
  type Carousel,
  type CarouselSlideData,
  type CarouselTemplate,
  type AvatarVideo,
  type SocialPost,
  type InstagramConnection,
  type InsertInstagramConnection,
  type CanvaConnection,
  type InsertCanvaConnection,
  type LinkedInConnection,
  type InsertLinkedInConnection,
  heygenDigitalTwins,
  type HeygenDigitalTwin,
  type InsertHeygenDigitalTwin,
  searchConsoleConnections,
  type SearchConsoleConnection,
  type InsertSearchConsoleConnection,
  type FeatureFlag,
  type PostMetric,
  type TemplatePerformance,
  type EditorialPlanItem,
  type InsertEditorialPlanItem,
  type InstagramAccountInsightsDaily,
  type InstagramDemographicsBreakdown,
  brandKits,
  type BrandKit,
  type CommentAutomation,
  trendingTopics,
  userTopicAngles,
  type TrendingTopic,
  type UserTopicAngle,
  companies,
  companyDomains,
  artTemplates,
  artworks,
  type Company,
  type CompanyDomain,
  type ArtTemplate,
  type Artwork,
  contentApprovals,
  type ContentApproval,
  auditLog,
  type AuditLog,
  type InsertAuditLog,
  emailTokens,
  type EmailToken,
} from "../drizzle/schema";
import { createHash, randomBytes, randomInt } from "node:crypto";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // max: 20 conexões no pool; prepare: false mantém compatibilidade com o
      // pooler do Supabase em modo transaction.
      const client = postgres(process.env.DATABASE_URL, { max: 20, prepare: false });
      _db = drizzle(client);
      // O drizzle desliga a conversão de timestamptz (OID 1184) do driver porque
      // converte por conta própria nas colunas tipadas. O SQL cru deste arquivo
      // passa e recebe Date diretamente (como no mysql2), então restauramos.
      client.options.serializers[1184] = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
      client.options.parsers[1184] = (v: string) => new Date(v);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// SQL cru. Devolve [linhas, null] — o mesmo formato do mysql2 — para que os
// acessos `const [rows] = ...` deste arquivo continuem válidos.
async function execute(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  query: SQL
): Promise<[any[], null]> {
  const rows = await db.execute(query);
  return [Array.from(rows), null];
}

function parseCarouselSlides(value: unknown): CarouselSlideData[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        title: typeof item.title === "string" ? item.title : "",
        body: typeof item.body === "string" ? item.body : "",
        imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
        profileId: typeof item.profileId === "string" ? item.profileId : undefined,
        slideType: (item.slideType === "hook" || item.slideType === "development" || item.slideType === "cta") ? item.slideType : undefined,
        shortText: typeof item.shortText === "string" ? item.shortText : undefined,
        imagePrompt: typeof item.imagePrompt === "string" ? item.imagePrompt : undefined,
        backgroundPrompt: typeof item.backgroundPrompt === "string" ? item.backgroundPrompt : undefined,
        visualDirection: typeof item.visualDirection === "string" ? item.visualDirection : undefined,
        layoutNotes: typeof item.layoutNotes === "string" ? item.layoutNotes : undefined,
        highlightWords: Array.isArray(item.highlightWords) ? (item.highlightWords as string[]).filter((w) => typeof w === "string") : undefined,
        wordStyles: Array.isArray(item.wordStyles)
          ? (item.wordStyles as unknown[]).filter((w): w is Record<string, unknown> => typeof w === "object" && w !== null).map((w) => ({
              word: typeof w.word === "string" ? w.word : "",
              color: typeof w.color === "string" ? w.color : undefined,
              bold: typeof w.bold === "boolean" ? w.bold : undefined,
              italic: typeof w.italic === "boolean" ? w.italic : undefined,
            })).filter((w) => w.word)
          : undefined,
        titleColor: typeof item.titleColor === "string" ? item.titleColor : undefined,
        bodyColor: typeof item.bodyColor === "string" ? item.bodyColor : undefined,
        designTemplateName:
          typeof item.designTemplateName === "string" ? item.designTemplateName : undefined,
        designTemplateUrl:
          typeof item.designTemplateUrl === "string" ? item.designTemplateUrl : undefined,
        designStyleBrief:
          typeof item.designStyleBrief === "string" ? item.designStyleBrief : undefined,
        templateSvgUrl:
          typeof item.templateSvgUrl === "string" ? item.templateSvgUrl : undefined,
        renderedImageUrl:
          typeof item.renderedImageUrl === "string" ? item.renderedImageUrl : undefined,
        fontFamily:
          typeof item.fontFamily === "string" ? item.fontFamily : undefined,
        accentColor:
          typeof item.accentColor === "string" ? item.accentColor : undefined,
        backgroundColor:
          typeof item.backgroundColor === "string" ? item.backgroundColor : undefined,
        editorSettings:
          typeof item.editorSettings === "object" && item.editorSettings !== null
            ? (() => {
                const editorSettings = item.editorSettings as Record<string, unknown>;
                return {
                  titleOffsetX:
                    typeof editorSettings.titleOffsetX === "number"
                      ? editorSettings.titleOffsetX
                      : undefined,
                  titleOffsetY:
                    typeof editorSettings.titleOffsetY === "number"
                      ? editorSettings.titleOffsetY
                      : undefined,
                  titleScale:
                    typeof editorSettings.titleScale === "number"
                      ? editorSettings.titleScale
                      : undefined,
                  bodyOffsetX:
                    typeof editorSettings.bodyOffsetX === "number"
                      ? editorSettings.bodyOffsetX
                      : undefined,
                  bodyOffsetY:
                    typeof editorSettings.bodyOffsetY === "number"
                      ? editorSettings.bodyOffsetY
                      : undefined,
                  bodyScale:
                    typeof editorSettings.bodyScale === "number"
                      ? editorSettings.bodyScale
                      : undefined,
                  imageOffsetX:
                    typeof editorSettings.imageOffsetX === "number"
                      ? editorSettings.imageOffsetX
                      : undefined,
                  imageOffsetY:
                    typeof editorSettings.imageOffsetY === "number"
                      ? editorSettings.imageOffsetY
                      : undefined,
                  imageScale:
                    typeof editorSettings.imageScale === "number"
                      ? editorSettings.imageScale
                      : undefined,
                  imageRotation:
                    typeof editorSettings.imageRotation === "number"
                      ? editorSettings.imageRotation
                      : undefined,
                  imageBrightness:
                    typeof editorSettings.imageBrightness === "number"
                      ? editorSettings.imageBrightness
                      : undefined,
                  imageContrast:
                    typeof editorSettings.imageContrast === "number"
                      ? editorSettings.imageContrast
                      : undefined,
                  imageSaturate:
                    typeof editorSettings.imageSaturate === "number"
                      ? editorSettings.imageSaturate
                      : undefined,
                  titleColor:
                    typeof editorSettings.titleColor === "string"
                      ? editorSettings.titleColor
                      : undefined,
                  bodyColor:
                    typeof editorSettings.bodyColor === "string"
                      ? editorSettings.bodyColor
                      : undefined,
                };
              })()
            : undefined,
      }));
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    return parseCarouselSlides(JSON.parse(value));
  } catch {
    return [];
  }
}

function hydrateCarousel(row: Omit<Carousel, "slides"> & { slides: unknown; designSettings?: unknown }): Carousel {
  const hydrated: Carousel = {
    ...row,
    slides: parseCarouselSlides(row.slides),
  };
  if (row.designSettings && typeof row.designSettings === "string") {
    try { (hydrated as Record<string, unknown>).designSettings = JSON.parse(row.designSettings); } catch { /* ignore */ }
  }
  return hydrated;
}

// ─── Approval columns migration ──────────────────────────────────────────────

// ─── Users — runtime column migration ────────────────────────────────────────

// ─── Users — colunas de segurança (criptografia / sessão / verificação / 2FA) ──
// A migration formal 0020+ faz o trabalho estrutural (widen de email, índices).
// Este guard só garante os ADD COLUMN idempotentes em ambientes onde a migration
// ficou pra trás, seguindo o padrão dos outros ensure*Columns() do arquivo.

// ─── Users — helpers de criptografia de campos ───────────────────────────────

function emailDomainOf(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

/** Decifra name/email de uma linha de user vinda do banco (in-place num clone). */
function decryptUserRow<T extends Record<string, unknown> | undefined | null>(row: T): T {
  if (!row) return row;
  return {
    ...row,
    name: decryptField((row as Record<string, unknown>).name as string | null),
    email: decryptField((row as Record<string, unknown>).email as string | null),
  } as T;
}

/**
 * Aplica cifra em name/email e deriva emailHash + emailDomain num objeto de
 * escrita (insert/update). Não toca em campos ausentes.
 */
function encryptUserWrite<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  if ("email" in out) {
    const plain = out.email == null ? null : String(out.email);
    out.email = encryptField(plain);
    out.emailHash = plain ? blindIndex(plain) : null;
    out.emailDomain = emailDomainOf(plain);
  }
  if ("name" in out && out.name != null) {
    out.name = encryptField(String(out.name));
  }
  return out as T;
}

// ─── Tokens OAuth — cifra em repouso ────────────────────────────────────────
// accessToken / refreshToken das tabelas *_connections passam a guardar
// ciphertext. Leitura retrocompatível (valores sem prefixo passam direto).

function decryptTokenRow<T extends Record<string, unknown> | null | undefined>(row: T): T {
  if (!row) return row;
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  if ("accessToken" in out) out.accessToken = decryptField(out.accessToken as string | null);
  if ("userAccessToken" in out) out.userAccessToken = decryptField(out.userAccessToken as string | null);
  if ("refreshToken" in out) out.refreshToken = decryptField(out.refreshToken as string | null);
  return out as T;
}

function encryptTokenWrite<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  if ("accessToken" in out) out.accessToken = encryptField(out.accessToken as string | null | undefined);
  if ("userAccessToken" in out) out.userAccessToken = encryptField(out.userAccessToken as string | null | undefined);
  if ("refreshToken" in out) out.refreshToken = encryptField(out.refreshToken as string | null | undefined);
  return out as T;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      let normalized: string | null = (value ?? null) as string | null;
      if (field === "email") {
        const plainEmail = normalized;
        const emailHash = plainEmail ? blindIndex(plainEmail) : null;
        const emailDomain = emailDomainOf(plainEmail);
        normalized = encryptField(plainEmail);
        (values as Record<string, unknown>).emailHash = emailHash;
        updateSet.emailHash = emailHash;
        (values as Record<string, unknown>).emailDomain = emailDomain;
        updateSet.emailDomain = emailDomain;
      } else if (field === "name") {
        normalized = encryptField(normalized);
      }
      (values as Record<string, unknown>)[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    if ((user as { trialExpiresAt?: Date | null }).trialExpiresAt !== undefined) {
      const t = (user as { trialExpiresAt?: Date | null }).trialExpiresAt ?? null;
      (values as Record<string, unknown>).trialExpiresAt = t;
      updateSet.trialExpiresAt = t;
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? decryptUserRow(result[0]) : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? decryptUserRow(result[0]) : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  // Busca pelo blind index (o e-mail fica cifrado no banco).
  const result = await db.select().from(users).where(eq(users.emailHash, blindIndex(email))).limit(1);
  return result.length > 0 ? decryptUserRow(result[0]) : undefined;
}

export async function getUserByOpenIdWithActiveCheck(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  const user = result[0];
  if (!user) return undefined;
  // isActive defaults to true for rows that pre-date the column
  const isActive = (user as unknown as { isActive?: number | boolean }).isActive;
  if (isActive === 0 || isActive === false) return null; // null = found but inactive
  return decryptUserRow(user);
}

export async function setUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function updateUserPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

// Invalida todas as sessões emitidas até agora para este usuário.
export async function bumpUserTokenVersion(id: number) {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`UPDATE users SET "tokenVersion" = "tokenVersion" + 1 WHERE id = ${id}`);
}

export async function markEmailVerified(id: number) {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`UPDATE users SET "emailVerifiedAt" = NOW() WHERE id = ${id} AND "emailVerifiedAt" IS NULL`);
}

export async function setTwoFactorEnabled(id: number, enabled: boolean) {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`UPDATE users SET "twoFactorEnabled" = ${enabled} WHERE id = ${id}`);
}

// ─── Audit log ───────────────────────────────────────────────────────────────

/** Registra uma ação sensível. Best-effort: nunca lança. */
export async function recordAudit(entry: Omit<InsertAuditLog, "id" | "createdAt">): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLog).values({
      ...entry,
      userAgent: entry.userAgent ? String(entry.userAgent).slice(0, 255) : null,
    });
  } catch (e) {
    console.warn("[audit] falha ao registrar:", String(e).slice(0, 200));
  }
}

export async function getAuditLog(limit = 200): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

// ─── Email tokens (verify / reset / 2fa) ─────────────────────────────────────

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

type EmailTokenType = "verify" | "reset" | "2fa";

/**
 * Cria um token de e-mail. `raw` é o valor cru (link ou código); só o hash é
 * guardado. Invalida tokens anteriores não consumidos do mesmo tipo.
 */
export async function createEmailToken(
  userId: number,
  type: EmailTokenType,
  raw: string,
  ttlMs: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(emailTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(emailTokens.userId, userId), eq(emailTokens.type, type), isNull(emailTokens.consumedAt)));
  await db.insert(emailTokens).values({
    userId,
    type,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + ttlMs),
  });
}

/** Retorna o token válido (não consumido, não expirado) sem consumi-lo. */
export async function peekEmailToken(type: EmailTokenType, raw: string): Promise<EmailToken | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(emailTokens)
    .where(and(
      eq(emailTokens.type, type),
      eq(emailTokens.tokenHash, hashToken(raw)),
      isNull(emailTokens.consumedAt),
    ))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function consumeEmailTokenById(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(emailTokens).set({ consumedAt: new Date() }).where(eq(emailTokens.id, id));
}

export async function getEmailTokenById(id: number): Promise<EmailToken | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(emailTokens).where(eq(emailTokens.id, id)).limit(1);
  return row ?? null;
}

export async function incrementEmailTokenAttempts(id: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  await execute(db, sql`UPDATE email_tokens SET attempts = attempts + 1 WHERE id = ${id}`);
  const [row] = await db.select({ attempts: emailTokens.attempts }).from(emailTokens).where(eq(emailTokens.id, id)).limit(1);
  return row?.attempts ?? 0;
}

/** Busca um token 2fa/reset ativo pelo id do usuário (fluxo por código). */
export async function getActiveEmailTokenForUser(userId: number, type: EmailTokenType): Promise<EmailToken | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(emailTokens)
    .where(and(eq(emailTokens.userId, userId), eq(emailTokens.type, type), isNull(emailTokens.consumedAt)))
    .orderBy(desc(emailTokens.createdAt))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateNumericCode(digits = 6): string {
  return String(randomInt(0, 10 ** digits)).padStart(digits, "0");
}

// Backfill legacy accounts (trialExpiresAt IS NULL, plan='free', not admin) with a 7-day trial from now.
export async function migrateNullTrialDates(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await execute(db, 
    sql`UPDATE users SET "trialExpiresAt" = ${sevenDaysFromNow}
        WHERE "trialExpiresAt" IS NULL AND plan = 'free' AND role != 'admin'`
  );
}

export async function setUserPlan(id: number, plan: "free" | "pro" | "agency") {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`UPDATE users SET plan = ${plan} WHERE id = ${id}`);
}

export async function setUserActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`UPDATE users SET "isActive" = ${isActive} WHERE id = ${id}`);
}

export async function deleteUserById(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, id));
}

// ─── Equipe (funcionários de uma conta principal) ─────────────────────────────
// Conteúdo nunca fica preso ao id do funcionário — sempre é gravado com o id
// da conta principal (ver server/_core/context.ts, resolução de ctx.user).
// Essas funções só tocam a própria linha de login do funcionário.

export async function getTeamMembers(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(users).where(eq(users.companyOwnerId, ownerId)).orderBy(asc(users.createdAt));
  return rows.map((r) => decryptUserRow(r));
}

export async function createTeamMember(
  ownerId: number,
  data: { name: string; email: string; password: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const passwordHash = await hashPassword(data.password);
  const openId = `local_${nanoid()}`;
  await db.insert(users).values(encryptUserWrite({
    openId,
    name: data.name,
    email: data.email,
    loginMethod: "email",
    passwordHash,
    companyOwnerId: ownerId,
  }));
  const [member] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (!member) throw new Error("Falha ao criar membro da equipe");
  return decryptUserRow(member);
}

async function assertOwnsTeamMember(ownerId: number, memberId: number): Promise<void> {
  const member = await getUserById(memberId);
  if (!member || member.companyOwnerId !== ownerId) {
    throw new Error("Membro da equipe não encontrado para esta conta.");
  }
}

export async function setTeamMemberActive(ownerId: number, memberId: number, isActive: boolean) {
  await assertOwnsTeamMember(ownerId, memberId);
  await setUserActive(memberId, isActive);
}

export async function removeTeamMember(ownerId: number, memberId: number) {
  await assertOwnsTeamMember(ownerId, memberId);
  await deleteUserById(memberId);
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  return rows.map((u) => decryptUserRow(u)).map((u) => ({
    ...u,
    plan: ((u as unknown as { plan?: string }).plan ?? "free") as "free" | "pro" | "agency",
    isActive: u.isActive,
    trialExpiresAt: (u as unknown as { trialExpiresAt?: Date | null }).trialExpiresAt ?? null,
  }));
}

export async function listUsersWithStats() {
  const db = await getDb();
  if (!db) return [];
  // Ensure all lazily-created tables exist before querying them
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));

  type CountRow = { userId: number; n: number };
  const countStar = sql<number>`count(*)`;

  // Aggregate content counts per userId in parallel using raw sql count (safe across all Drizzle versions)
  const [imgCounts, artCounts, carCounts, vidCounts, postCounts, chatCounts] = await Promise.all([
    db.select({ userId: generatedImages.userId,     n: countStar }).from(generatedImages).groupBy(generatedImages.userId),
    db.select({ userId: articles.userId,            n: countStar }).from(articles).groupBy(articles.userId),
    db.select({ userId: carousels.userId,           n: countStar }).from(carousels).groupBy(carousels.userId),
    db.select({ userId: avatarVideos.userId,        n: countStar }).from(avatarVideos).groupBy(avatarVideos.userId),
    db.select({ userId: socialPosts.userId,         n: countStar }).from(socialPosts).groupBy(socialPosts.userId),
    db.select({ userId: chatConversations.userId,   n: countStar }).from(chatConversations).groupBy(chatConversations.userId),
  ]);

  const toMap = (arr: CountRow[]) =>
    Object.fromEntries((arr as CountRow[]).map((r) => [r.userId, Number(r.n)]));

  const imgs  = toMap(imgCounts  as unknown as CountRow[]);
  const arts  = toMap(artCounts  as unknown as CountRow[]);
  const cars  = toMap(carCounts  as unknown as CountRow[]);
  const vids  = toMap(vidCounts  as unknown as CountRow[]);
  const posts = toMap(postCounts as unknown as CountRow[]);
  const chats = toMap(chatCounts as unknown as CountRow[]);

  return rows.map((u) => decryptUserRow(u)).map((u) => ({
    ...u,
    plan: ((u as unknown as { plan?: string }).plan ?? "free") as "free" | "pro" | "agency",
    isActive: u.isActive,
    trialExpiresAt: (u as unknown as { trialExpiresAt?: Date | null }).trialExpiresAt ?? null,
    usage: {
      images:   imgs[u.id]  ?? 0,
      articles: arts[u.id]  ?? 0,
      carousel: cars[u.id]  ?? 0,
      videos:   vids[u.id]  ?? 0,
      posts:    posts[u.id] ?? 0,
      chats:    chats[u.id] ?? 0,
    },
  }));
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function getConversations(userId: number): Promise<ChatConversation[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatConversations)
    .where(eq(chatConversations.userId, userId))
    .orderBy(desc(chatConversations.updatedAt));
}

export async function createConversation(userId: number, title?: string): Promise<ChatConversation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(chatConversations).values({
    userId,
    title: title || "Nova Conversa",
  }).returning({ id: chatConversations.id });
  const created = await db.select().from(chatConversations)
    .where(eq(chatConversations.id, insertId(result))).limit(1);
  return created[0];
}

export async function updateConversationTitle(id: number, userId: number, title: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(chatConversations).set({ title }).where(
    and(eq(chatConversations.id, id), eq(chatConversations.userId, userId))
  );
}

export async function deleteConversation(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(chatMessages).where(
    and(eq(chatMessages.conversationId, id), eq(chatMessages.userId, userId))
  );
  await db.delete(chatConversations).where(
    and(eq(chatConversations.id, id), eq(chatConversations.userId, userId))
  );
}

export async function getMessages(conversationId: number, userId: number): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(chatMessages)
    .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.userId, userId)))
    .orderBy(chatMessages.createdAt);
  return rows.map((m) => ({ ...m, content: decryptField(m.content) ?? "" }));
}

export async function addMessage(
  conversationId: number,
  userId: number,
  role: "user" | "assistant",
  content: string
): Promise<ChatMessage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [owned] = await db.select({ id: chatConversations.id }).from(chatConversations)
    .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
    .limit(1);
  if (!owned) throw new Error("Conversation not found");
  const [result] = await db.insert(chatMessages).values({ conversationId, userId, role, content: encryptField(content) }).returning({ id: chatMessages.id });
  // Update conversation updatedAt
  await db.update(chatConversations).set({ updatedAt: new Date() })
    .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)));
  const created = await db.select().from(chatMessages)
    .where(eq(chatMessages.id, insertId(result))).limit(1);
  return { ...created[0], content: decryptField(created[0].content) ?? "" };
}

export async function getChatCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: count() }).from(chatConversations).where(eq(chatConversations.userId, userId));
  return row?.count ?? 0;
}

// ─── Images ───────────────────────────────────────────────────────────────────

export async function getImages(userId: number): Promise<GeneratedImage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedImages)
    .where(eq(generatedImages.userId, userId))
    .orderBy(desc(generatedImages.createdAt));
}

export async function saveImage(
  userId: number,
  prompt: string,
  imageUrl: string,
  fileKey?: string,
  width?: number,
  height?: number
): Promise<GeneratedImage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(generatedImages).values({ userId, prompt, imageUrl, fileKey, width, height }).returning({ id: generatedImages.id });
  const created = await db.select().from(generatedImages)
    .where(eq(generatedImages.id, insertId(result))).limit(1);
  return created[0];
}

export async function getImageById(id: number, userId: number): Promise<GeneratedImage | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(generatedImages).where(
    and(eq(generatedImages.id, id), eq(generatedImages.userId, userId))
  );
  return row ?? null;
}

export async function deleteImage(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(generatedImages).where(
    and(eq(generatedImages.id, id), eq(generatedImages.userId, userId))
  );
}

export async function getImageCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: count() }).from(generatedImages).where(eq(generatedImages.userId, userId));
  return row?.count ?? 0;
}

// ─── Articles ─────────────────────────────────────────────────────────────────

// Campos de texto longo de artigos guardam ciphertext ("enc:v1:..."). Decifra
// in-place (a linha vem fresca do drizzle, mutação é segura).
function decryptArticleRow<T extends Record<string, unknown> | undefined>(row: T): T {
  if (!row) return row;
  const r = row as Record<string, unknown>;
  r.content = decryptField(r.content as string | null) ?? "";
  r.summary = decryptField(r.summary as string | null);
  r.topic = decryptField(r.topic as string | null);
  return row;
}
function encryptArticleWrite<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  if ("content" in out) out.content = encryptField(out.content as string | null | undefined);
  if ("summary" in out) out.summary = encryptField(out.summary as string | null | undefined);
  if ("topic" in out) out.topic = encryptField(out.topic as string | null | undefined);
  return out as T;
}

export async function getArticles(userId: number): Promise<Article[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(articles)
    .where(eq(articles.userId, userId))
    .orderBy(desc(articles.createdAt));
  return rows.map((r) => decryptArticleRow(r));
}

export async function getArticle(id: number, userId: number): Promise<Article | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(articles)
    .where(and(eq(articles.id, id), eq(articles.userId, userId))).limit(1);
  return decryptArticleRow(result[0]);
}

export async function saveArticle(
  userId: number,
  data: {
    title: string;
    topic?: string;
    sourceUrl?: string;
    coverImageUrl?: string;
    content: string;
    summary?: string;
    sourceTopicAngleId?: number;
    hookType?: string;
    contentFormat?: string;
  }
): Promise<Article> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(articles).values(encryptArticleWrite({ userId, ...data })).returning({ id: articles.id });
  const created = await db.select().from(articles)
    .where(eq(articles.id, insertId(result))).limit(1);
  return decryptArticleRow(created[0])!;
}

export async function updateArticle(
  id: number,
  userId: number,
  data: Partial<{
    title: string;
    content: string;
    coverImageUrl: string;
    status: "draft" | "published" | "archived";
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(articles).set(encryptArticleWrite(data)).where(
    and(eq(articles.id, id), eq(articles.userId, userId))
  );
}

export async function deleteArticle(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(articles).where(and(eq(articles.id, id), eq(articles.userId, userId)));
}

export async function getArticleCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: count() }).from(articles).where(eq(articles.userId, userId));
  return row?.count ?? 0;
}

export async function getCarousels(userId: number): Promise<Carousel[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(carousels)
    .where(eq(carousels.userId, userId))
    .orderBy(desc(carousels.createdAt));
  return result.map((row) => hydrateCarousel(row as Omit<Carousel, "slides"> & { slides: unknown }));
}

export async function saveCarousel(
  userId: number,
  data: {
    topic: string;
    style: string;
    hook: string;
    caption: string;
    finalCta: string;
    coverImageUrl?: string;
    slides: CarouselSlideData[];
    sourceTopicAngleId?: number;
    hookType?: string;
    contentFormat?: string;
    templateId?: number;
  }
): Promise<Carousel> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(carousels).values({
    userId,
    ...data,
    slides: JSON.stringify(data.slides),
  }).returning({ id: carousels.id });
  const created = await db.select().from(carousels)
    .where(eq(carousels.id, insertId(result))).limit(1);
  return hydrateCarousel(created[0] as Omit<Carousel, "slides"> & { slides: unknown });
}

export async function deleteCarousel(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(carousels).where(and(eq(carousels.id, id), eq(carousels.userId, userId)));
}

export async function updateCarouselSlides(
  id: number,
  userId: number,
  slides: CarouselSlideData[]
): Promise<Carousel | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(carousels).set({
    slides: JSON.stringify(slides),
    updatedAt: new Date(),
  }).where(and(eq(carousels.id, id), eq(carousels.userId, userId)));

  const updated = await db.select().from(carousels)
    .where(and(eq(carousels.id, id), eq(carousels.userId, userId))).limit(1);

  if (!updated[0]) return undefined;
  return hydrateCarousel(updated[0] as Omit<Carousel, "slides"> & { slides: unknown });
}

export async function updateCarouselContent(
  id: number,
  userId: number,
  data: {
    hook: string;
    caption: string;
    finalCta: string;
    slides: CarouselSlideData[];
    designSettings?: Record<string, unknown>;
  }
): Promise<Carousel | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(carousels).set({
    hook: data.hook,
    caption: data.caption,
    finalCta: data.finalCta,
    slides: JSON.stringify(data.slides),
    designSettings: data.designSettings ? JSON.stringify(data.designSettings) : null,
    updatedAt: new Date(),
  }).where(and(eq(carousels.id, id), eq(carousels.userId, userId)));

  const updated = await db.select().from(carousels)
    .where(and(eq(carousels.id, id), eq(carousels.userId, userId))).limit(1);

  if (!updated[0]) return undefined;
  return hydrateCarousel(updated[0] as Omit<Carousel, "slides"> & { slides: unknown });
}

export async function getCarouselCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: count() }).from(carousels).where(eq(carousels.userId, userId));
  return row?.count ?? 0;
}

// ─── Social Posts ─────────────────────────────────────────────────────────────

export async function getCarouselTemplates(userId: number): Promise<CarouselTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(carouselTemplates)
    .where(eq(carouselTemplates.userId, userId))
    .orderBy(desc(carouselTemplates.createdAt));
}

export async function getCarouselTemplate(
  id: number,
  userId: number
): Promise<CarouselTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(carouselTemplates)
    .where(and(eq(carouselTemplates.id, id), eq(carouselTemplates.userId, userId)))
    .limit(1);
  return result[0];
}

export async function saveCarouselTemplate(
  userId: number,
  data: {
    name: string;
    imageUrl: string;
    styleBrief?: string;
  }
): Promise<CarouselTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(carouselTemplates).values({
    userId,
    name: data.name,
    imageUrl: data.imageUrl,
    styleBrief: data.styleBrief ?? null,
  }).returning({ id: carouselTemplates.id });
  const created = await db
    .select()
    .from(carouselTemplates)
    .where(eq(carouselTemplates.id, insertId(result)))
    .limit(1);
  return created[0];
}

export async function deleteCarouselTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(carouselTemplates)
    .where(and(eq(carouselTemplates.id, id), eq(carouselTemplates.userId, userId)));
}

export async function getAvatarVideos(userId: number): Promise<AvatarVideo[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(avatarVideos)
    .where(eq(avatarVideos.userId, userId))
    .orderBy(desc(avatarVideos.createdAt));
}

export async function saveAvatarVideo(
  userId: number,
  data: {
    provider?: string;
    title: string;
    topic?: string;
    script: string;
    sourceImageUrl: string;
    videoUrl?: string;
    voiceProvider?: string;
    voiceId?: string;
    providerJobId?: string;
    status?: "processing" | "completed" | "failed";
    errorMessage?: string;
  }
): Promise<AvatarVideo> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(avatarVideos).values({
    userId,
    provider: data.provider ?? "d-id",
    title: data.title,
    topic: data.topic,
    script: data.script,
    sourceImageUrl: data.sourceImageUrl,
    videoUrl: data.videoUrl,
    voiceProvider: data.voiceProvider,
    voiceId: data.voiceId,
    providerJobId: data.providerJobId,
    status: data.status ?? "processing",
    errorMessage: data.errorMessage,
  }).returning({ id: avatarVideos.id });
  const created = await db.select().from(avatarVideos)
    .where(eq(avatarVideos.id, insertId(result))).limit(1);
  return created[0];
}

export async function updateAvatarVideo(
  id: number,
  userId: number,
  data: Partial<{
    title: string;
    topic: string | null;
    script: string;
    sourceImageUrl: string;
    videoUrl: string | null;
    voiceProvider: string | null;
    voiceId: string | null;
    providerJobId: string | null;
    status: "processing" | "completed" | "failed";
    errorMessage: string | null;
  }>
): Promise<AvatarVideo | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(avatarVideos).set({
    ...data,
    updatedAt: new Date(),
  }).where(and(eq(avatarVideos.id, id), eq(avatarVideos.userId, userId)));

  const updated = await db.select().from(avatarVideos)
    .where(and(eq(avatarVideos.id, id), eq(avatarVideos.userId, userId))).limit(1);

  return updated[0];
}

export async function deleteAvatarVideo(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(avatarVideos).where(and(eq(avatarVideos.id, id), eq(avatarVideos.userId, userId)));
}

export async function getAvatarVideoCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: count() }).from(avatarVideos).where(eq(avatarVideos.userId, userId));
  return row?.count ?? 0;
}

export async function getSocialPosts(
  userId: number,
  channel?: "instagram" | "linkedin" | "newsletter"
): Promise<SocialPost[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = channel
    ? and(eq(socialPosts.userId, userId), eq(socialPosts.channel, channel))
    : eq(socialPosts.userId, userId);
  return db.select().from(socialPosts)
    .where(conditions)
    .orderBy(desc(socialPosts.createdAt));
}

export async function getDueScheduledInstagramPosts(
  now = new Date(),
  limit = 20
): Promise<SocialPost[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(socialPosts)
    .where(
      and(
        eq(socialPosts.channel, "instagram"),
        eq(socialPosts.status, "scheduled"),
        lte(socialPosts.scheduledAt, now)
      )
    )
    .orderBy(asc(socialPosts.scheduledAt))
    .limit(limit);
}

export async function saveSocialPost(
  userId: number,
  data: {
    channel: "instagram" | "linkedin" | "newsletter";
    title?: string;
    content: string;
    imageUrl?: string;
    metadata?: string;
    scheduledAt?: Date;
    contentType?: string;
    contentId?: number;
    storyData?: string;
  }
): Promise<SocialPost> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const status = data.scheduledAt ? "scheduled" : "draft";
  const [result] = await db.insert(socialPosts).values({ userId, ...data, status }).returning({ id: socialPosts.id });
  const created = await db.select().from(socialPosts)
    .where(eq(socialPosts.id, insertId(result))).limit(1);
  return created[0];
}

export async function getStoryPosts(userId: number): Promise<SocialPost[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(socialPosts).where(
    and(eq(socialPosts.userId, userId), eq(socialPosts.contentType, "story"))
  ).orderBy(desc(socialPosts.createdAt));
}

export async function getSocialPostById(id: number, userId: number): Promise<SocialPost | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(socialPosts).where(
    and(eq(socialPosts.id, id), eq(socialPosts.userId, userId))
  ).limit(1);
  return rows[0] ?? null;
}

export async function updateSocialPost(
  id: number,
  userId: number,
  data: Partial<{
    content: string;
    title: string;
    status: "draft" | "scheduled" | "published" | "failed";
    imageUrl: string | null;
    metadata: string | null;
    scheduledAt: Date | null;
    publishedAt: Date | null;
    errorMessage: string | null;
    igMediaId: string | null;
    contentType: string | null;
    contentId: number | null;
    storyData: string | null;
    retryCount: number;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(socialPosts).set(data).where(
    and(eq(socialPosts.id, id), eq(socialPosts.userId, userId))
  );
}

export async function deleteSocialPost(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(socialPosts).where(and(eq(socialPosts.id, id), eq(socialPosts.userId, userId)));
}

export async function setSocialPostPendingApproval(
  id: number,
  userId: number,
  token: string,
  expiresAt: Date
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`
    UPDATE social_posts
    SET status = 'pending_approval', "approvalToken" = ${token}, "approvalExpiresAt" = ${expiresAt}
    WHERE id = ${id} AND "userId" = ${userId}
  `);
}

export async function getSocialPostByApprovalToken(
  token: string
): Promise<SocialPost | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await execute(db, sql`
    SELECT * FROM social_posts WHERE "approvalToken" = ${token} LIMIT 1
  `) as unknown as [Array<Record<string, unknown>>, unknown];
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return row as unknown as SocialPost;
}

export async function resolveApprovalToken(
  token: string,
  action: "approve" | "reject"
): Promise<{ ok: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "Banco de dados indisponível" };

  const post = await getSocialPostByApprovalToken(token);
  if (!post) return { ok: false, reason: "Token inválido ou expirado" };
  if (post.status !== "pending_approval") {
    return { ok: false, reason: `Este post já foi ${post.status === "published" ? "publicado" : post.status}` };
  }

  const expires = (post as unknown as Record<string, unknown>).approvalExpiresAt as Date | null;
  if (expires && new Date() > new Date(expires)) {
    return { ok: false, reason: "Link de aprovação expirado" };
  }

  const newStatus = action === "approve" ? "scheduled" : "rejected";
  await execute(db, sql`
    UPDATE social_posts
    SET status = ${newStatus}, "approvalToken" = NULL, "approvalExpiresAt" = NULL
    WHERE id = ${post.id}
  `);
  return { ok: true };
}

export async function getPostCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: count() }).from(socialPosts).where(eq(socialPosts.userId, userId));
  return row?.count ?? 0;
}

// ─── Instagram Connections ────────────────────────────────────────────────────

export async function getInstagramConnection(userId: number): Promise<InstagramConnection | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(instagramConnections).where(eq(instagramConnections.userId, userId));
  return row ? decryptTokenRow(row) : null;
}

export async function getInstagramConnectionByIgId(igAccountId: string): Promise<InstagramConnection | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(instagramConnections).where(eq(instagramConnections.instagramAccountId, igAccountId));
  return row ? decryptTokenRow(row) : null;
}

export async function upsertInstagramConnection(data: InsertInstagramConnection): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getInstagramConnection(data.userId);
  if (existing) {
    await db.update(instagramConnections)
      .set(encryptTokenWrite({
        instagramAccountId: data.instagramAccountId,
        facebookPageId: data.facebookPageId ?? null,
        username: data.username,
        name: data.name,
        profilePictureUrl: data.profilePictureUrl,
        accessToken: data.accessToken,
        userAccessToken: data.userAccessToken,
        tokenExpiresAt: data.tokenExpiresAt,
        tokenSource: data.tokenSource ?? "facebook",
      }))
      .where(eq(instagramConnections.userId, data.userId));
  } else {
    await db.insert(instagramConnections).values(encryptTokenWrite({
      ...data,
      tokenSource: data.tokenSource ?? "facebook",
    }));
  }
}

export async function deleteInstagramConnection(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(instagramConnections).where(eq(instagramConnections.userId, userId));
}

// ─── Canva Connections ────────────────────────────────────────────────────────

export async function getCanvaConnection(userId: number): Promise<CanvaConnection | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(canvaConnections).where(eq(canvaConnections.userId, userId));
    return row ? decryptTokenRow(row) : null;
  } catch {
    return null;
  }
}

export async function upsertCanvaConnection(data: InsertCanvaConnection): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getCanvaConnection(data.userId);
  if (existing) {
    await db.update(canvaConnections)
      .set(encryptTokenWrite({
        canvaUserId: data.canvaUserId,
        displayName: data.displayName,
        email: data.email,
        profilePictureUrl: data.profilePictureUrl,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
      }))
      .where(eq(canvaConnections.userId, data.userId));
  } else {
    await db.insert(canvaConnections).values(encryptTokenWrite({ ...data }));
  }
}

export async function deleteCanvaConnection(userId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.delete(canvaConnections).where(eq(canvaConnections.userId, userId));
  } catch {
    // table may not exist yet
  }
}

// ─── LinkedIn Connections ──────────────────────────────────────────────────────

export async function getLinkedInConnection(userId: number): Promise<LinkedInConnection | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(linkedinConnections).where(eq(linkedinConnections.userId, userId));
    return row ? decryptTokenRow(row) : null;
  } catch {
    return null;
  }
}

export async function upsertLinkedInConnection(data: InsertLinkedInConnection): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getLinkedInConnection(data.userId);
  if (existing) {
    await db.update(linkedinConnections)
      .set(encryptTokenWrite({
        linkedinMemberId: data.linkedinMemberId,
        authorUrn: data.authorUrn,
        name: data.name,
        email: data.email,
        profilePictureUrl: data.profilePictureUrl,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
      }))
      .where(eq(linkedinConnections.userId, data.userId));
  } else {
    await db.insert(linkedinConnections).values(encryptTokenWrite({ ...data }));
  }
}

export async function deleteLinkedInConnection(userId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.delete(linkedinConnections).where(eq(linkedinConnections.userId, userId));
  } catch {
    // table may not exist yet
  }
}

// ─── HeyGen Digital Twin ────────────────────────────────────────────────────

export async function getHeygenDigitalTwin(userId: number): Promise<HeygenDigitalTwin | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(heygenDigitalTwins).where(eq(heygenDigitalTwins.userId, userId));
    return row ?? null;
  } catch {
    return null;
  }
}

export async function upsertHeygenDigitalTwin(data: InsertHeygenDigitalTwin): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getHeygenDigitalTwin(data.userId);
  if (existing) {
    await db.update(heygenDigitalTwins)
      .set({
        avatarId: data.avatarId ?? existing.avatarId,
        groupId: data.groupId,
        name: data.name ?? existing.name,
        status: data.status,
        errorMessage: data.errorMessage ?? null,
      })
      .where(eq(heygenDigitalTwins.userId, data.userId));
  } else {
    await db.insert(heygenDigitalTwins).values(data);
  }
}

export async function deleteHeygenDigitalTwin(userId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.delete(heygenDigitalTwins).where(eq(heygenDigitalTwins.userId, userId));
  } catch {
    // table may not exist yet
  }
}

// ─── Google Search Console Connections ─────────────────────────────────────────

export async function getSearchConsoleConnection(userId: number): Promise<SearchConsoleConnection | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(searchConsoleConnections).where(eq(searchConsoleConnections.userId, userId));
    return row ? decryptTokenRow(row) : null;
  } catch {
    return null;
  }
}

export async function upsertSearchConsoleConnection(data: InsertSearchConsoleConnection): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getSearchConsoleConnection(data.userId);
  if (existing) {
    await db.update(searchConsoleConnections)
      .set(encryptTokenWrite({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? existing.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        selectedSiteUrl: data.selectedSiteUrl ?? existing.selectedSiteUrl,
        availableSites: data.availableSites ?? existing.availableSites,
      }))
      .where(eq(searchConsoleConnections.userId, data.userId));
  } else {
    await db.insert(searchConsoleConnections).values(encryptTokenWrite({ ...data }));
  }
}

export async function updateSearchConsoleSelectedSite(userId: number, selectedSiteUrl: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(searchConsoleConnections)
    .set({ selectedSiteUrl })
    .where(eq(searchConsoleConnections.userId, userId));
}

export async function updateSearchConsoleTokens(
  userId: number,
  data: { accessToken: string; tokenExpiresAt: Date }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(searchConsoleConnections)
    .set({ accessToken: encryptField(data.accessToken), tokenExpiresAt: data.tokenExpiresAt })
    .where(eq(searchConsoleConnections.userId, userId));
}

export async function deleteSearchConsoleConnection(userId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.delete(searchConsoleConnections).where(eq(searchConsoleConnections.userId, userId));
  } catch {
    // table may not exist yet
  }
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(featureFlags).orderBy(asc(featureFlags.createdAt));
}

export async function getFeatureFlagByKey(key: string): Promise<FeatureFlag | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(featureFlags).where(eq(featureFlags.key, key));
  return row ?? null;
}

export async function upsertFeatureFlag(
  key: string,
  label: string,
  description: string | undefined,
  enabled: boolean,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getFeatureFlagByKey(key);
  if (existing) {
    await db.update(featureFlags)
      .set({ label, description: description ?? null, enabled })
      .where(eq(featureFlags.key, key));
  } else {
    await db.insert(featureFlags).values({ key, label, description: description ?? null, enabled });
  }
}

export async function toggleFeatureFlag(key: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(featureFlags).set({ enabled }).where(eq(featureFlags.key, key));
}

export async function deleteFeatureFlag(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(featureFlags).where(eq(featureFlags.key, key));
}

// ─── Brand Kits ───────────────────────────────────────────────────────────────

// Uma conta pode ter várias marcas (agência gerenciando vários clientes);
// users.activeBrandKitId aponta pra qual delas preenche automaticamente os
// módulos de geração. Drop do UNIQUE em brand_kits.userId + a coluna nova em
// users seguem o mesmo padrão "auto-cura em runtime" das outras migrações
// de brand_kits — nunca passou por drizzle-kit, então mantemos o padrão.

export async function listBrandKits(userId: number): Promise<BrandKit[]> {
  const db = await getDb();
  if (!db) return [];
  const [rows] = await execute(db, 
    sql`SELECT * FROM brand_kits WHERE "userId" = ${userId} ORDER BY id ASC`
  ) as unknown as [Array<Record<string, unknown>>, unknown];
  return rows as unknown as BrandKit[];
}

export async function getActiveBrandKit(userId: number): Promise<BrandKit | null> {
  const db = await getDb();
  if (!db) return null;
  try {

    const [userRows] = await execute(db, 
      sql`SELECT "activeBrandKitId" FROM users WHERE id = ${userId} LIMIT 1`
    ) as unknown as [Array<{ activeBrandKitId: number | null }>, unknown];
    const activeBrandKitId = userRows[0]?.activeBrandKitId;

    if (activeBrandKitId) {
      const [rows] = await execute(db, 
        sql`SELECT * FROM brand_kits WHERE id = ${activeBrandKitId} AND "userId" = ${userId} LIMIT 1`
      ) as unknown as [Array<Record<string, unknown>>, unknown];
      if (rows[0]) return rows[0] as unknown as BrandKit;
    }

    // Sem marca ativa definida (conta nova ou nunca migrada) — cai pra
    // primeira marca da conta, preservando o comportamento de antes do
    // multi-brand pra quem só tem uma.
    const [rows] = await execute(db, 
      sql`SELECT * FROM brand_kits WHERE "userId" = ${userId} ORDER BY id ASC LIMIT 1`
    ) as unknown as [Array<Record<string, unknown>>, unknown];
    return rows[0] ? (rows[0] as unknown as BrandKit) : null;
  } catch (e) {
    console.error("[BrandKit] getActiveBrandKit error:", e);
    return null;
  }
}

// Alias — todo o resto da plataforma (geração de imagem, SEO, stories, plano
// editorial etc.) já lê "a marca do usuário" e passa a ler "a marca ativa"
// automaticamente, sem precisar tocar em cada call site.
export async function getBrandKit(userId: number): Promise<BrandKit | null> {
  return getActiveBrandKit(userId);
}

export type BrandKitData = Omit<BrandKit, "id" | "userId" | "createdAt" | "updatedAt"> & {
  nicheId?: string | null;
  subNicheId?: string | null;
};

// Coerce empty strings to null so MySQL doesn't reject them
function normalizeBrandKitField(v: string | null | undefined): string | null {
  return v === "" || v == null ? null : v;
}

// ─── WhatsApp Digest ───────────────────────────────────────────────────────────

// ── Delivered news deduplication ─────────────────────────────────────────────

function normalizeDeliveredUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.href.toLowerCase().slice(0, 500);
  } catch {
    return url.toLowerCase().slice(0, 500);
  }
}

export async function getDeliveredNewsKeys(userId: number, daysBack = 7): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const rows = await execute(db, sql`
    SELECT url_key FROM delivered_news
    WHERE user_id = ${userId} AND delivered_at > ${cutoff}
  `);
  const list = (rows[0] as unknown as Array<{ url_key: string }>);
  return new Set(list.map((r) => r.url_key));
}

export async function saveDeliveredNews(
  userId: number,
  items: { url: string; title?: string | null }[]
): Promise<void> {
  const db = await getDb();
  if (!db || items.length === 0) return;
  for (const item of items) {
    const key = normalizeDeliveredUrl(item.url);
    await execute(db, sql`
        INSERT INTO delivered_news (user_id, url_key, title)
        VALUES (${userId}, ${key}, ${(item.title ?? "").slice(0, 500)})
        ON CONFLICT (user_id, url_key) DO NOTHING
      `)
      .catch(() => {});
  }
}

// ── Digest tables ─────────────────────────────────────────────────────────────

export type DigestSettings = {
  id: number;
  userId: number;
  whatsappNumber: string;
  digestHour: number;
  digestMinute: number;
  enabled: boolean;
  lastSentDate: string | null;
  templateName: string;
  templateLanguage: string;
  replyWebhookUrl: string | null;
};

export async function getUserDigestSettings(userId: number): Promise<DigestSettings | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await execute(db, sql`SELECT * FROM user_digest_settings WHERE user_id = ${userId} LIMIT 1`);
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    whatsappNumber: String(row.whatsapp_number),
    digestHour: Number(row.digest_hour),
    digestMinute: Number(row.digest_minute),
    enabled: Boolean(Number(row.enabled)),
    lastSentDate: row.last_sent_date ? String(row.last_sent_date) : null,
    templateName: row.template_name ? String(row.template_name) : "envio_de_noticias_diario",
    templateLanguage: row.template_language ? String(row.template_language) : "pt_BR",
    replyWebhookUrl: row.reply_webhook_url ? decryptField(String(row.reply_webhook_url)) : null,
  };
}

export async function upsertDigestSettings(
  userId: number,
  data: { whatsappNumber: string; digestHour: number; digestMinute: number; enabled: boolean; templateName?: string; templateLanguage?: string; replyWebhookUrl?: string | null }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const tplName = data.templateName ?? "envio_de_noticias_diario";
  const tplLang = data.templateLanguage ?? "pt_BR";
  const webhookUrl = encryptField(data.replyWebhookUrl ?? null);
  await execute(db, sql`
    INSERT INTO user_digest_settings (user_id, whatsapp_number, digest_hour, digest_minute, enabled, template_name, template_language, reply_webhook_url)
    VALUES (${userId}, ${data.whatsappNumber}, ${data.digestHour}, ${data.digestMinute}, ${data.enabled}, ${tplName}, ${tplLang}, ${webhookUrl})
    ON CONFLICT (user_id) DO UPDATE SET
      whatsapp_number    = EXCLUDED.whatsapp_number,
      digest_hour        = EXCLUDED.digest_hour,
      digest_minute      = EXCLUDED.digest_minute,
      enabled            = EXCLUDED.enabled,
      template_name      = EXCLUDED.template_name,
      template_language  = EXCLUDED.template_language,
      reply_webhook_url  = EXCLUDED.reply_webhook_url
  `);
}

export async function resetDigestLastSent(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`UPDATE user_digest_settings SET last_sent_date = NULL WHERE user_id = ${userId}`);
}

export async function markDigestLastSent(userId: number, dateStr: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`UPDATE user_digest_settings SET last_sent_date = ${dateStr} WHERE user_id = ${userId}`);
}

export async function getAllEnabledDigestSettings(): Promise<DigestSettings[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await execute(db, sql`SELECT * FROM user_digest_settings WHERE enabled = true`);
  return (rows[0] as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    userId: Number(row.user_id),
    whatsappNumber: String(row.whatsapp_number),
    digestHour: Number(row.digest_hour),
    digestMinute: Number(row.digest_minute),
    enabled: Boolean(Number(row.enabled)),
    lastSentDate: row.last_sent_date ? String(row.last_sent_date) : null,
    templateName: row.template_name ? String(row.template_name) : "envio_de_noticias_diario",
    templateLanguage: row.template_language ? String(row.template_language) : "pt_BR",
    replyWebhookUrl: row.reply_webhook_url ? decryptField(String(row.reply_webhook_url)) : null,
  }));
}

export type DigestNewsItem = {
  title: string;
  url: string;
  source: string;
  excerpt: string | null;
  publishedAt: string | null;
};

// Remove +, spaces and dashes so "5511..." and "+55 11..." both match
function normalizePhone(phone: string): string {
  return phone.replace(/[\s+\-().]/g, "");
}

// Brazilian mobile numbers: 55 + 2-digit area + 9 + 8-digit (13 total) ↔ without leading 9 (12 total)
function brazilianVariant(normalized: string): string | null {
  if (!normalized.startsWith('55')) return null;
  if (normalized.length === 13 && normalized[4] === '9') {
    return normalized.slice(0, 4) + normalized.slice(5);
  }
  if (normalized.length === 12) {
    return normalized.slice(0, 4) + '9' + normalized.slice(4);
  }
  return null;
}

export async function saveDigestSession(
  userId: number,
  phoneNumber: string,
  newsItems: DigestNewsItem[],
  campaignId?: string,
  messageText?: string
): Promise<{ id: number; campaignId: string }> {
  const db = await getDb();
  const campaign = campaignId ?? randomCampaignId();
  if (!db) return { id: 0, campaignId: campaign };
  const normalized = normalizePhone(phoneNumber);
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  console.log(`[DigestSession] Salvando sessão phone=${normalized} userId=${userId} campaign=${campaign}`);
  const insertResult = await execute(db, sql`
    INSERT INTO whatsapp_digest_sessions (campaign_id, user_id, phone_number, news_items, message_text, sent_at, expires_at)
    VALUES (${campaign}, ${userId}, ${normalized}, ${JSON.stringify(newsItems)}, ${messageText ?? null}, ${now}, ${expires})
    RETURNING id
  `);
  return { id: insertId(insertResult[0]), campaignId: campaign };
}

// Usada pela rota de link curto (/n/:id/:idx) para redirecionar até a notícia
// original sem depender do reply-matching de 24h (que serve outro propósito).
export async function getDigestSessionNewsItems(id: number): Promise<DigestNewsItem[] | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await execute(db, sql`SELECT news_items FROM whatsapp_digest_sessions WHERE id = ${id} LIMIT 1`);
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  try {
    return JSON.parse(String(row.news_items)) as DigestNewsItem[];
  } catch {
    return null;
  }
}

export async function recordSessionResponse(
  phoneNumber: string,
  choice: number
): Promise<{ userId: number; campaignId: string; newsItems: DigestNewsItem[]; chosenItem: DigestNewsItem } | null> {
  const db = await getDb();
  if (!db) return null;
  const normalized = normalizePhone(phoneNumber);
  const withPlus = `+${normalized}`;
  const brAlt = brazilianVariant(normalized);
  const brCondition = brAlt ? sql`OR phone_number = ${brAlt} OR phone_number = ${`+${brAlt}`}` : sql``;
  console.log(`[DigestSession] Buscando sessão para phone=${normalized}${brAlt ? ` | variante BR: ${brAlt}` : ''} choice=${choice}`);
  const rows = await execute(db, sql`
    SELECT id, campaign_id, user_id, news_items FROM whatsapp_digest_sessions
    WHERE (phone_number = ${normalized} OR phone_number = ${withPlus} ${brCondition})
      AND expires_at > NOW() AND user_response IS NULL
    ORDER BY sent_at DESC LIMIT 1
  `);
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  if (!row) {
    console.warn(`[DigestSession] Sessão não encontrada para phone=${normalized} nem variantes`);
    return null;
  }
  let newsItems: DigestNewsItem[];
  try { newsItems = JSON.parse(String(row.news_items)) as DigestNewsItem[]; }
  catch { return null; }
  const idx = choice - 1;
  const chosenItem = newsItems[idx];
  if (!chosenItem) return null;
  await execute(db, sql`
    UPDATE whatsapp_digest_sessions
    SET user_response = ${String(choice)}, chosen_index = ${idx}, responded_at = NOW()
    WHERE id = ${Number(row.id)}
  `);
  console.log(`[DigestSession] Sessão encontrada e registrada: userId=${String(row.user_id)} campaign=${String(row.campaign_id)}`);
  return {
    userId: Number(row.user_id),
    campaignId: String(row.campaign_id),
    newsItems,
    chosenItem,
  };
}

function randomCampaignId(): string {
  return `camp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getActiveDigestSession(
  phoneNumber: string
): Promise<{ userId: number; newsItems: DigestNewsItem[] } | null> {
  const db = await getDb();
  if (!db) return null;
  const normalized = normalizePhone(phoneNumber);
  const withPlus = `+${normalized}`;
  const brAlt = brazilianVariant(normalized);
  const brCondition = brAlt ? sql`OR phone_number = ${brAlt} OR phone_number = ${`+${brAlt}`}` : sql``;
  const rows = await execute(db, sql`
    SELECT user_id, news_items FROM whatsapp_digest_sessions
    WHERE (phone_number = ${normalized} OR phone_number = ${withPlus} ${brCondition}) AND expires_at > NOW()
    ORDER BY sent_at DESC LIMIT 1
  `);
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  try {
    return {
      userId: Number(row.user_id),
      newsItems: JSON.parse(String(row.news_items)) as DigestNewsItem[],
    };
  } catch {
    return null;
  }
}

export async function getRecentSentNewsUrls(userId: number, daysBack = 7): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await execute(db, sql`
    SELECT news_items FROM whatsapp_digest_sessions
    WHERE user_id = ${userId}
      AND sent_at >= NOW() - make_interval(days => ${daysBack})
    ORDER BY sent_at DESC
  `);
  const urls = new Set<string>();
  for (const row of rows[0] as unknown as Array<Record<string, unknown>>) {
    try {
      const items = JSON.parse(String(row.news_items)) as DigestNewsItem[];
      for (const item of items) {
        if (item.url) urls.add(item.url.trim().replace(/\/$/, "").toLowerCase());
      }
    } catch { /* skip malformed rows */ }
  }
  return urls;
}

// ─────────────────────────────────────────────────────────────
// Reels Scripts
// ─────────────────────────────────────────────────────────────

export type ReelsScript = {
  id: number;
  userId: number;
  title: string;
  topic: string;
  tone: string;
  duration: string;
  hook: string;
  reward: string;
  loopClose: string;
  caption: string;
  hashtags: string[];
  scenes: import('./_core/reelsScriptAgent').ReelsScene[];
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
};

function hydrateReelsScript(row: Record<string, unknown>): ReelsScript {
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    title: String(row.title),
    topic: String(row.topic),
    tone: String(row.tone ?? 'educational'),
    duration: String(row.duration ?? 'medium'),
    hook: String(row.hook ?? ''),
    reward: String(row.reward ?? ''),
    loopClose: String(row.loopClose ?? ''),
    caption: String(row.caption ?? ''),
    hashtags: (() => { try { return JSON.parse(String(row.hashtags ?? '[]')); } catch { return []; } })(),
    scenes: (() => { try { return JSON.parse(String(row.scenes ?? '[]')); } catch { return []; } })(),
    status: (row.status as 'draft' | 'published') ?? 'draft',
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt)),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(String(row.updatedAt)),
  };
}

export async function getReelsScripts(userId: number): Promise<ReelsScript[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await execute(db, sql`
    SELECT * FROM reels_scripts WHERE "userId" = ${userId} ORDER BY "createdAt" DESC
  `);
  return (rows[0] as unknown as Record<string, unknown>[]).map(hydrateReelsScript);
}

export async function saveReelsScript(
  userId: number,
  data: {
    title: string;
    topic: string;
    tone: string;
    duration: string;
    hook: string;
    reward: string;
    loopClose: string;
    caption: string;
    hashtags: string[];
    scenes: import('./_core/reelsScriptAgent').ReelsScene[];
    sourceTopicAngleId?: number;
    hookType?: string;
    contentFormat?: string;
  }
): Promise<ReelsScript> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const insertResult = await execute(db, sql`
    INSERT INTO reels_scripts ("userId", title, topic, tone, duration, hook, reward, "loopClose", caption, hashtags, scenes, "sourceTopicAngleId", "hookType", "contentFormat")
    VALUES (
      ${userId},
      ${data.title},
      ${data.topic},
      ${data.tone},
      ${data.duration},
      ${data.hook},
      ${data.reward},
      ${data.loopClose},
      ${data.caption},
      ${JSON.stringify(data.hashtags)},
      ${JSON.stringify(data.scenes)},
      ${data.sourceTopicAngleId ?? null},
      ${data.hookType ?? null},
      ${data.contentFormat ?? 'reels'}
    )
    RETURNING id
  `);
  const id = insertId(insertResult[0]);
  const selectResult = await execute(db, sql`SELECT * FROM reels_scripts WHERE id = ${id}`);
  return hydrateReelsScript((selectResult[0] as unknown as Record<string, unknown>[])[0]);
}

export async function deleteReelsScript(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`DELETE FROM reels_scripts WHERE id = ${id} AND "userId" = ${userId}`);
}

export async function getReelsScriptCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const cntResult = await execute(db, sql`SELECT COUNT(*) as cnt FROM reels_scripts WHERE "userId" = ${userId}`);
  const row = (cntResult[0] as unknown as Record<string, unknown>[])[0];
  return Number(row?.cnt ?? 0);
}

// ─────────────────────────────────────────────────────────────
// Comment Alerts (Phase 5 — 60-minute engagement window)
// ─────────────────────────────────────────────────────────────

export type CommentAlert = {
  id: number;
  userId: number;
  mediaId: string;
  mediaCaption: string | null;
  mediaPermalink: string | null;
  previousCount: number;
  newCount: number;
  detectedAt: Date;
  whatsappSentAt: Date | null;
  acknowledgedAt: Date | null;
};

function hydrateAlert(row: Record<string, unknown>): CommentAlert {
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    mediaId: String(row.mediaId),
    mediaCaption: row.mediaCaption ? String(row.mediaCaption) : null,
    mediaPermalink: row.mediaPermalink ? String(row.mediaPermalink) : null,
    previousCount: Number(row.previousCount ?? 0),
    newCount: Number(row.newCount ?? 0),
    detectedAt: row.detectedAt instanceof Date ? row.detectedAt : new Date(String(row.detectedAt)),
    whatsappSentAt: row.whatsappSentAt ? (row.whatsappSentAt instanceof Date ? row.whatsappSentAt : new Date(String(row.whatsappSentAt))) : null,
    acknowledgedAt: row.acknowledgedAt ? (row.acknowledgedAt instanceof Date ? row.acknowledgedAt : new Date(String(row.acknowledgedAt))) : null,
  };
}

export async function getCommentPollCount(userId: number, mediaId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await execute(db, sql`
    SELECT "lastKnownCount" FROM comment_poll_state
    WHERE "userId" = ${userId} AND "mediaId" = ${mediaId}
  `);
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  return row ? Number(row.lastKnownCount) : -1;
}

export async function upsertCommentPollState(userId: number, mediaId: string, count: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`
    INSERT INTO comment_poll_state ("userId", "mediaId", "lastKnownCount")
    VALUES (${userId}, ${mediaId}, ${count})
    ON CONFLICT ("userId", "mediaId") DO UPDATE SET "lastKnownCount" = ${count}, "lastCheckedAt" = CURRENT_TIMESTAMP
  `);
}

export async function insertCommentAlert(
  userId: number,
  data: {
    mediaId: string;
    mediaCaption?: string | null;
    mediaPermalink?: string | null;
    previousCount: number;
    newCount: number;
  }
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await execute(db, sql`
    INSERT INTO comment_alerts ("userId", "mediaId", "mediaCaption", "mediaPermalink", "previousCount", "newCount")
    VALUES (
      ${userId},
      ${data.mediaId},
      ${data.mediaCaption ?? null},
      ${data.mediaPermalink ?? null},
      ${data.previousCount},
      ${data.newCount}
    )
    RETURNING id
  `);
  return insertId(result[0]);
}

export async function markAlertWhatsappSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`UPDATE comment_alerts SET "whatsappSentAt" = CURRENT_TIMESTAMP WHERE id = ${id}`);
}

export async function acknowledgeCommentAlert(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`
    UPDATE comment_alerts SET "acknowledgedAt" = CURRENT_TIMESTAMP
    WHERE id = ${id} AND "userId" = ${userId}
  `);
}

export async function getOpenCommentAlerts(userId: number): Promise<CommentAlert[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await execute(db, sql`
    SELECT * FROM comment_alerts
    WHERE "userId" = ${userId} AND "acknowledgedAt" IS NULL
    ORDER BY "detectedAt" DESC
    LIMIT 20
  `);
  return (rows[0] as unknown as Record<string, unknown>[]).map(hydrateAlert);
}

export async function getAllInstagramConnections(): Promise<Array<{ userId: number; instagramAccountId: string; accessToken: string }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await execute(db, sql`
    SELECT "userId", "instagramAccountId", "accessToken" FROM instagram_connections
    WHERE "accessToken" IS NOT NULL AND "instagramAccountId" IS NOT NULL
  `);
  return (rows[0] as unknown as Array<Record<string, unknown>>).map((r) => ({
    userId: Number(r.userId),
    instagramAccountId: String(r.instagramAccountId),
    accessToken: decryptField(String(r.accessToken)) ?? "",
  }));
}

export async function getInstagramConnectionsExpiringBefore(
  cutoff: Date
): Promise<Array<{ userId: number; username: string | null; accessToken: string; tokenSource: string; tokenExpiresAt: Date | null }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    userId: instagramConnections.userId,
    username: instagramConnections.username,
    accessToken: instagramConnections.accessToken,
    tokenSource: instagramConnections.tokenSource,
    tokenExpiresAt: instagramConnections.tokenExpiresAt,
  }).from(instagramConnections)
    .where(lte(instagramConnections.tokenExpiresAt, cutoff));
  return rows.map((r) => ({
    ...r,
    accessToken: decryptField(r.accessToken) ?? "",
    tokenSource: r.tokenSource ?? "facebook",
  }));
}

export async function updateInstagramConnectionToken(
  userId: number,
  accessToken: string,
  tokenExpiresAt: Date
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(instagramConnections)
    .set({ accessToken: encryptField(accessToken), tokenExpiresAt })
    .where(eq(instagramConnections.userId, userId));
}

// ─── Comment Automations (Comment-to-DM) ─────────────────────────────────────

function hydrateAutomation(row: Record<string, unknown>): CommentAutomation {
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    igAccountId: String(row.igAccountId),
    igPostId: String(row.igPostId),
    postCaption: row.postCaption != null ? String(row.postCaption) : null,
    postThumbnailUrl: row.postThumbnailUrl != null ? String(row.postThumbnailUrl) : null,
    keywords: (() => { try { return typeof row.keywords === 'string' ? JSON.parse(row.keywords) : (row.keywords as string[]); } catch { return []; } })(),
    publicReplyMessage: String(row.publicReplyMessage ?? ''),
    dmFirstMessage: String(row.dmFirstMessage ?? ''),
    dmFollowupMessage: row.dmFollowupMessage != null ? String(row.dmFollowupMessage) : null,
    dmLink: row.dmLink != null ? String(row.dmLink) : null,
    status: String(row.status ?? 'active'),
    commentsMatchedCount: Number(row.commentsMatchedCount ?? 0),
    dmsSentCount: Number(row.dmsSentCount ?? 0),
    linkClicksCount: Number(row.linkClicksCount ?? 0),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt)),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(String(row.updatedAt)),
  };
}

export async function getCommentAutomations(userId: number): Promise<CommentAutomation[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await execute(db, sql`
    SELECT * FROM comment_automations WHERE "userId" = ${userId} ORDER BY "createdAt" DESC
  `);
  return (rows[0] as unknown as Record<string, unknown>[]).map(hydrateAutomation);
}

export async function createCommentAutomation(
  userId: number,
  data: {
    igAccountId: string;
    igPostId: string;
    postCaption?: string | null;
    postThumbnailUrl?: string | null;
    keywords: string[];
    publicReplyMessage: string;
    dmFirstMessage: string;
    dmFollowupMessage?: string | null;
    dmLink?: string | null;
  }
): Promise<CommentAutomation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await execute(db, sql`
    INSERT INTO comment_automations
      ("userId", "igAccountId", "igPostId", "postCaption", "postThumbnailUrl", keywords,
       "publicReplyMessage", "dmFirstMessage", "dmFollowupMessage", "dmLink")
    VALUES (
      ${userId}, ${data.igAccountId}, ${data.igPostId},
      ${data.postCaption ?? null}, ${data.postThumbnailUrl ?? null},
      ${JSON.stringify(data.keywords)},
      ${data.publicReplyMessage}, ${data.dmFirstMessage},
      ${data.dmFollowupMessage ?? null}, ${data.dmLink ?? null}
    )
    RETURNING id
  `);
  const rows = await execute(db, sql`SELECT * FROM comment_automations WHERE id = ${insertId(result[0])} LIMIT 1`);
  return hydrateAutomation((rows[0] as unknown as Record<string, unknown>[])[0]);
}

export async function toggleCommentAutomationStatus(id: number, userId: number): Promise<'active' | 'paused'> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await execute(db, sql`SELECT status FROM comment_automations WHERE id = ${id} AND "userId" = ${userId} LIMIT 1`);
  const current = ((rows[0] as unknown as Record<string, unknown>[])[0])?.status as string ?? 'active';
  const next = current === 'active' ? 'paused' : 'active';
  await execute(db, sql`UPDATE comment_automations SET status = ${next} WHERE id = ${id} AND "userId" = ${userId}`);
  return next;
}

export async function deleteCommentAutomation(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`DELETE FROM comment_automations WHERE id = ${id} AND "userId" = ${userId}`);
}

export async function matchCommentAutomation(
  igAccountId: string,
  igPostId: string,
  commentText: string
): Promise<CommentAutomation | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await execute(db, sql`
    SELECT * FROM comment_automations
    WHERE "igAccountId" = ${igAccountId} AND "igPostId" = ${igPostId} AND status = 'active'
  `);
  const campaigns = (rows[0] as unknown as Record<string, unknown>[]).map(hydrateAutomation);
  console.log(`[DB] matchCommentAutomation: igAccountId=${igAccountId}, igPostId=${igPostId}, campaigns_found=${campaigns.length}`);
  if (campaigns.length === 0) {
    // Debug: show all active campaigns to help diagnose mismatch
    const allRows = await execute(db, sql`SELECT "igAccountId", "igPostId", status, keywords FROM comment_automations WHERE status = 'active' LIMIT 5`);
    const allCampaigns = allRows[0] as unknown as Array<{ igAccountId: string; igPostId: string; status: string; keywords: string }>;
    console.log(`[DB] Campanhas ativas no banco:`, JSON.stringify(allCampaigns));
  }
  const lowerComment = commentText.toLowerCase();
  return campaigns.find((c) =>
    c.keywords.some((kw) => lowerComment.includes(kw.toLowerCase()))
  ) ?? null;
}

export async function getInstagramConnectionByAutomationId(automationId: number): Promise<InstagramConnection | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await execute(db, sql`SELECT "userId" FROM comment_automations WHERE id = ${automationId} LIMIT 1`);
  const userId = ((rows[0] as unknown as Record<string, unknown>[])[0])?.userId as number | undefined;
  if (!userId) return null;
  return getInstagramConnection(userId);
}

export async function incrementCommentMatchedCount(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`UPDATE comment_automations SET "commentsMatchedCount" = "commentsMatchedCount" + 1 WHERE id = ${id}`);
}

export async function incrementDmsSentCount(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`UPDATE comment_automations SET "dmsSentCount" = "dmsSentCount" + 1 WHERE id = ${id}`);
}

// ─── Niche Profiles ───────────────────────────────────────────────────────────

let _nicheProfilesReady: Promise<void> | null = null;

async function ensureNicheProfilesTable() {
  const db = await getDb();
  if (!db) return;
  if (!_nicheProfilesReady) {
    _nicheProfilesReady = seedNicheProfiles(db).catch((e) => { _nicheProfilesReady = null; throw e; });
  }
  await _nicheProfilesReady;
}

async function seedNicheProfiles(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  const { NICHE_PROFILES } = await import('./_core/nicheProfilesSeed');
  const [rows] = await execute(db, sql`SELECT COUNT(*) as cnt FROM niche_profiles`) as unknown as [Array<{ cnt: number }>, unknown];
  if (Number((rows as Array<{ cnt: number }>)[0]?.cnt) > 0) return;
  for (const p of NICHE_PROFILES) {
    await execute(db, sql`
      INSERT INTO niche_profiles (id, label, version, "subNiches", "visualGrammar", "copyTone", "referenceImageTags", "carouselPatterns", keywords)
      VALUES (
        ${p.id}, ${p.label}, ${p.version},
        ${JSON.stringify(p.subNiches)},
        ${JSON.stringify(p.visualGrammar)},
        ${JSON.stringify(p.copyTone)},
        ${JSON.stringify(p.referenceImageTags)},
        ${JSON.stringify(p.carouselPatterns)},
        ${JSON.stringify(p.keywords)}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }
  console.log(`[NicheProfiles] Seeded ${NICHE_PROFILES.length} niche profiles.`);
}

export async function listNicheProfiles(): Promise<Array<{ id: string; label: string; version: number; subNiches: unknown; keywords: unknown }>> {
  const db = await getDb();
  if (!db) return [];
  await ensureNicheProfilesTable();
  const [rows] = await execute(db, sql`SELECT id, label, version, "subNiches", keywords FROM niche_profiles WHERE "isActive" = true ORDER BY label`) as unknown as [Array<Record<string, unknown>>, unknown];
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    label: String(r.label),
    version: Number(r.version ?? 1),
    subNiches: r.subNiches ? (typeof r.subNiches === 'string' ? JSON.parse(r.subNiches) : r.subNiches) : [],
    keywords: r.keywords ? (typeof r.keywords === 'string' ? JSON.parse(r.keywords) : r.keywords) : [],
  }));
}

export async function getNicheProfile(id: string): Promise<{ id: string; label: string; version: number; visualGrammar: unknown; copyTone: unknown; referenceImageTags: unknown; carouselPatterns: unknown } | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureNicheProfilesTable();
  const [rows] = await execute(db, sql`SELECT * FROM niche_profiles WHERE id = ${id} AND "isActive" = true LIMIT 1`) as unknown as [Array<Record<string, unknown>>, unknown];
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  const parse = (v: unknown) => v ? (typeof v === 'string' ? JSON.parse(v) : v) : null;
  return {
    id: String(row.id),
    label: String(row.label),
    version: Number(row.version ?? 1),
    visualGrammar: parse(row.visualGrammar),
    copyTone: parse(row.copyTone),
    referenceImageTags: parse(row.referenceImageTags),
    carouselPatterns: parse(row.carouselPatterns),
  };
}

// ─── Brand Kit niche columns migration ───────────────────────────────────────

// ─── Daily Usage (trial limits) ───────────────────────────────────────────────

export async function getDailyUsageCount(userId: number, feature: string, date: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: dailyUsage.count })
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.feature, feature), eq(dailyUsage.date, date)))
    .limit(1);
  return rows[0]?.count ?? 0;
}

export async function incrementDailyUsage(userId: number, feature: string, date: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`
    INSERT INTO daily_usage ("userId", feature, date, count)
    VALUES (${userId}, ${feature}, ${date}, 1)
    ON CONFLICT ("userId", feature, date) DO UPDATE SET count = daily_usage.count + 1
  `);
}

export async function getDailyUsageAll(userId: number, date: string): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select({ feature: dailyUsage.feature, count: dailyUsage.count })
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.date, date)));
  return Object.fromEntries(rows.map((r) => [r.feature, r.count]));
}

// ─── Post Metrics (Module 1.3) ────────────────────────────────────────────────

export async function savePostMetric(data: {
  socialPostId: number;
  reach: number;
  saves: number;
  shares: number;
  comments: number;
  likes: number;
  followsDelta: number;
  rawScore: number;
  normalizedScore: number;
  impressions?: number;
  videoViews?: number;
  avgWatchTimeMs?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(postMetrics).values({
    socialPostId: data.socialPostId,
    reach: data.reach,
    saves: data.saves,
    shares: data.shares,
    comments: data.comments,
    likes: data.likes,
    followsDelta: data.followsDelta,
    rawScore: data.rawScore,
    normalizedScore: data.normalizedScore,
    impressions: data.impressions ?? 0,
    videoViews: data.videoViews ?? 0,
    avgWatchTimeMs: data.avgWatchTimeMs ?? 0,
  });
}

export async function getLatestMetricForPost(socialPostId: number): Promise<PostMetric | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(postMetrics)
    .where(eq(postMetrics.socialPostId, socialPostId))
    .orderBy(desc(postMetrics.collectedAt))
    .limit(1);
  return rows[0] ?? null;
}

function todayDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
}

export async function saveInstagramAccountInsightsSnapshot(data: {
  userId: number;
  demographics?: InstagramDemographicsBreakdown;
  websiteClicks: number;
  phoneCallClicks: number;
  emailContacts: number;
  textMessageClicks: number;
  getDirectionsClicks: number;
  totalInteractions: number;
  accountsEngaged: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const dateKey = todayDateKey();

  const [existing] = await db
    .select()
    .from(instagramAccountInsightsDaily)
    .where(and(eq(instagramAccountInsightsDaily.userId, data.userId), eq(instagramAccountInsightsDaily.dateKey, dateKey)));

  const values = {
    demographics: data.demographics ?? undefined,
    websiteClicks: data.websiteClicks,
    phoneCallClicks: data.phoneCallClicks,
    emailContacts: data.emailContacts,
    textMessageClicks: data.textMessageClicks,
    getDirectionsClicks: data.getDirectionsClicks,
    totalInteractions: data.totalInteractions,
    accountsEngaged: data.accountsEngaged,
  };

  if (existing) {
    await db.update(instagramAccountInsightsDaily)
      .set(values)
      .where(eq(instagramAccountInsightsDaily.id, existing.id));
  } else {
    await db.insert(instagramAccountInsightsDaily).values({
      userId: data.userId,
      dateKey,
      ...values,
    });
  }
}

export async function getLatestInstagramAccountInsights(userId: number): Promise<InstagramAccountInsightsDaily | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(instagramAccountInsightsDaily)
    .where(eq(instagramAccountInsightsDaily.userId, userId))
    .orderBy(desc(instagramAccountInsightsDaily.dateKey))
    .limit(1);
  return rows[0] ?? null;
}

export async function getInstagramAccountInsightsHistory(userId: number, days: number): Promise<InstagramAccountInsightsDaily[]> {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 86400_000);
  const sinceKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(since);
  return db
    .select()
    .from(instagramAccountInsightsDaily)
    .where(and(eq(instagramAccountInsightsDaily.userId, userId), sql`${instagramAccountInsightsDaily.dateKey} >= ${sinceKey}`))
    .orderBy(asc(instagramAccountInsightsDaily.dateKey));
}

export async function getPublishedPostsWithIgMedia(): Promise<Array<{
  id: number;
  userId: number;
  igMediaId: string;
  contentType: string | null;
  style: string | null;
  hookType: string | null;
  contentFormat: string | null;
  sourceTopicAngleId: number | null;
  contentId: number | null;
  publishedAt: Date | null;
}>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await execute(db, sql`
    SELECT sp.id, sp."userId", sp."igMediaId", sp."contentType", sp."contentId", sp."publishedAt",
           COALESCE(c.style, r."contentFormat", 'unknown') AS style,
           COALESCE(c."hookType", r."hookType", sp."contentType") AS "hookType",
           COALESCE(c."contentFormat", r."contentFormat", sp."contentType") AS "contentFormat",
           COALESCE(c."sourceTopicAngleId", r."sourceTopicAngleId") AS "sourceTopicAngleId"
    FROM social_posts sp
    LEFT JOIN carousels c ON sp."contentType" = 'carousel' AND c.id = sp."contentId"
    LEFT JOIN reels_scripts r ON sp."contentType" = 'reels' AND r.id = sp."contentId"
    WHERE sp.status = 'published'
      AND sp."igMediaId" IS NOT NULL
      AND sp.channel = 'instagram'
    ORDER BY sp."publishedAt" DESC
    LIMIT 200
  `);
  return (rows[0] as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    userId: Number(r.userId),
    igMediaId: String(r.igMediaId),
    contentType: r.contentType ? String(r.contentType) : null,
    style: r.style ? String(r.style) : null,
    hookType: r.hookType ? String(r.hookType) : null,
    contentFormat: r.contentFormat ? String(r.contentFormat) : null,
    sourceTopicAngleId: r.sourceTopicAngleId != null ? Number(r.sourceTopicAngleId) : null,
    contentId: r.contentId != null ? Number(r.contentId) : null,
    publishedAt: r.publishedAt ? (r.publishedAt instanceof Date ? r.publishedAt : new Date(String(r.publishedAt))) : null,
  }));
}

export async function upsertTemplatePerformance(data: {
  userId: number;
  niche: string;
  templateStyle: string;
  hookType: string;
  contentFormat: string;
  sourceKind: string;
  avgScore: number;
  postCount: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await execute(db, sql`
    INSERT INTO template_performance ("userId", niche, "templateStyle", "hookType", "contentFormat", "sourceKind", "avgScore", "postCount")
    VALUES (${data.userId}, ${data.niche}, ${data.templateStyle}, ${data.hookType}, ${data.contentFormat}, ${data.sourceKind}, ${data.avgScore}, ${data.postCount})
    ON CONFLICT ("userId", niche, "templateStyle", "hookType", "contentFormat", "sourceKind") DO UPDATE SET
      "avgScore" = EXCLUDED."avgScore",
      "postCount" = EXCLUDED."postCount",
      "updatedAt" = CURRENT_TIMESTAMP
  `);
}

export async function getTopPerformanceForUser(userId: number, contentFormat?: string): Promise<TemplatePerformance[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = contentFormat
    ? await db.select().from(templatePerformance)
        .where(and(eq(templatePerformance.userId, userId), eq(templatePerformance.contentFormat, contentFormat), sql`"postCount" >= 3`))
        .orderBy(desc(templatePerformance.avgScore))
        .limit(10)
    : await db.select().from(templatePerformance)
        .where(and(eq(templatePerformance.userId, userId), sql`"postCount" >= 3`))
        .orderBy(desc(templatePerformance.avgScore))
        .limit(20);
  return rows;
}

export async function getUserNicheForPerformance(userId: number): Promise<string> {
  const kit = await getBrandKit(userId);
  return kit?.nicheId ?? "generic";
}

// ─── Editorial Plan Items (Module 2.1) ───────────────────────────────────────

export async function getEditorialPlanItems(userId: number, year: number, month: number): Promise<EditorialPlanItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(editorialPlanItems)
    .where(and(
      eq(editorialPlanItems.userId, userId),
      eq(editorialPlanItems.year, year),
      eq(editorialPlanItems.month, month),
    ))
    .orderBy(asc(editorialPlanItems.scheduledDate));
}

export async function countGeneratedPlanItems(userId: number, year: number, month: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [rows] = await execute(db, sql`
    SELECT COUNT(*) AS cnt FROM editorial_plan_items
    WHERE "userId" = ${userId} AND year = ${year} AND month = ${month}
    AND (status = 'done' OR "socialPostId" IS NOT NULL OR "contentId" IS NOT NULL)
  `);
  return Number((rows as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0);
}

export async function saveEditorialPlanItems(
  userId: number,
  year: number,
  month: number,
  items: Array<Omit<InsertEditorialPlanItem, "userId" | "year" | "month" | "id" | "createdAt" | "updatedAt">>
): Promise<EditorialPlanItem[]> {
  const db = await getDb();
  if (!db) return [];
  await db.delete(editorialPlanItems).where(
    and(
      eq(editorialPlanItems.userId, userId),
      eq(editorialPlanItems.year, year),
      eq(editorialPlanItems.month, month),
    )
  );
  if (items.length === 0) return [];
  await db.insert(editorialPlanItems).values(
    items.map((item) => ({ ...item, userId, year, month }))
  );
  return getEditorialPlanItems(userId, year, month);
}

/** Acrescenta pautas ao calendário sem mexer nas que já existem no mês. */
export async function addEditorialPlanItems(
  userId: number,
  items: Array<Omit<InsertEditorialPlanItem, "userId" | "year" | "month" | "id" | "createdAt" | "updatedAt">>
): Promise<number> {
  const db = await getDb();
  if (!db || items.length === 0) return 0;
  await db.insert(editorialPlanItems).values(items.map((item) => {
    const [year, month] = item.scheduledDate.split("-").map(Number);
    return { ...item, userId, year, month };
  }));
  return items.length;
}

export async function updateEditorialPlanItem(
  id: number,
  userId: number,
  data: Partial<Pick<EditorialPlanItem, "status" | "socialPostId" | "contentType" | "contentId" | "scheduledDate">>
): Promise<EditorialPlanItem | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(editorialPlanItems)
    .set(data)
    .where(and(eq(editorialPlanItems.id, id), eq(editorialPlanItems.userId, userId)));
  const [row] = await db.select().from(editorialPlanItems)
    .where(and(eq(editorialPlanItems.id, id), eq(editorialPlanItems.userId, userId)));
  return row ?? null;
}

export async function getEditorialPlanItemById(id: number, userId: number): Promise<EditorialPlanItem | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(editorialPlanItems)
    .where(and(eq(editorialPlanItems.id, id), eq(editorialPlanItems.userId, userId)));
  return row ?? null;
}

export async function deleteEditorialPlanItems(userId: number, year: number, month: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(editorialPlanItems).where(
    and(
      eq(editorialPlanItems.userId, userId),
      eq(editorialPlanItems.year, year),
      eq(editorialPlanItems.month, month),
    )
  );
}

export async function deleteEditorialPlanItemsByDate(userId: number, scheduledDate: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(editorialPlanItems).where(
    and(
      eq(editorialPlanItems.userId, userId),
      eq(editorialPlanItems.scheduledDate, scheduledDate),
    )
  );
}

export async function deleteEditorialPlanItem(userId: number, id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(editorialPlanItems).where(
    and(eq(editorialPlanItems.id, id), eq(editorialPlanItems.userId, userId))
  );
}

// ─── Art Studio (empresas, domínios e artes prontas editáveis) ────────────────

// Companies

export async function listCompanies(): Promise<Array<Company & { domains: CompanyDomain[] }>> {
  const db = await getDb();
  if (!db) return [];
  const companyRows = await db.select().from(companies).orderBy(desc(companies.createdAt));
  const domainRows = await db.select().from(companyDomains);
  return companyRows.map((c) => ({
    ...c,
    domains: domainRows.filter((d) => d.companyId === c.id),
  }));
}

export async function createCompany(name: string): Promise<Company> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(companies).values({ name }).returning({ id: companies.id });
  const [row] = await db.select().from(companies).where(eq(companies.id, insertId(result))).limit(1);
  return row;
}

export async function deleteCompany(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(companyDomains).where(eq(companyDomains.companyId, id));
  await db.delete(artTemplates).where(eq(artTemplates.companyId, id));
  await db.delete(companies).where(eq(companies.id, id));
}

export async function addCompanyDomain(companyId: number, domain: string): Promise<CompanyDomain> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalized = domain.trim().toLowerCase();
  const [result] = await db.insert(companyDomains).values({ companyId, domain: normalized }).returning({ id: companyDomains.id });
  const [row] = await db.select().from(companyDomains).where(eq(companyDomains.id, insertId(result))).limit(1);
  return row;
}

export async function removeCompanyDomain(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(companyDomains).where(eq(companyDomains.id, id));
}

export async function getCompanyByDomain(domain: string): Promise<Company | null> {
  const db = await getDb();
  if (!db) return null;
  const normalized = domain.trim().toLowerCase();
  const rows = await db
    .select({ id: companies.id, name: companies.name, createdAt: companies.createdAt })
    .from(companyDomains)
    .innerJoin(companies, eq(companies.id, companyDomains.companyId))
    .where(eq(companyDomains.domain, normalized))
    .limit(1);
  return rows[0] ?? null;
}

// Art templates

export async function listArtTemplates(companyId?: number | null): Promise<ArtTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  if (companyId === undefined) {
    return db.select().from(artTemplates).orderBy(desc(artTemplates.createdAt));
  }
  const visibility = companyId === null
    ? isNull(artTemplates.companyId)
    : or(eq(artTemplates.companyId, companyId), isNull(artTemplates.companyId));
  return db.select().from(artTemplates).where(visibility).orderBy(desc(artTemplates.createdAt));
}

export async function getArtTemplate(id: number): Promise<ArtTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(artTemplates).where(eq(artTemplates.id, id)).limit(1);
  return rows[0];
}

export async function createArtTemplate(data: {
  name: string;
  companyId: number | null;
  imageUrl: string;
  createdByUserId: number;
  width?: number;
  height?: number;
}): Promise<ArtTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(artTemplates).values({
    name: data.name,
    companyId: data.companyId,
    imageUrl: data.imageUrl,
    createdByUserId: data.createdByUserId,
    width: data.width ?? 1080,
    height: data.height ?? 1350,
  }).returning({ id: artTemplates.id });
  const [row] = await db.select().from(artTemplates).where(eq(artTemplates.id, insertId(result))).limit(1);
  return row;
}

export async function updateArtTemplate(
  id: number,
  data: { name?: string; canvasJson?: Record<string, unknown>; thumbnailUrl?: string }
): Promise<ArtTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.canvasJson !== undefined) updates.canvasJson = data.canvasJson;
  if (data.thumbnailUrl !== undefined) updates.thumbnailUrl = data.thumbnailUrl;
  if (Object.keys(updates).length > 0) {
    await db.update(artTemplates).set(updates).where(eq(artTemplates.id, id));
  }
  const rows = await db.select().from(artTemplates).where(eq(artTemplates.id, id)).limit(1);
  return rows[0];
}

export async function deleteArtTemplate(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(artworks).where(eq(artworks.templateId, id));
  await db.delete(artTemplates).where(eq(artTemplates.id, id));
}

// Artworks (cópia editada de um template, salva pelo usuário)

export async function listArtworks(userId: number): Promise<Artwork[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(artworks).where(eq(artworks.userId, userId)).orderBy(desc(artworks.updatedAt));
}

export async function saveArtwork(data: {
  templateId: number;
  userId: number;
  canvasJson: Record<string, unknown>;
  imageUrl: string;
}): Promise<Artwork> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(artworks).values({
    templateId: data.templateId,
    userId: data.userId,
    canvasJson: data.canvasJson,
    imageUrl: data.imageUrl,
  }).returning({ id: artworks.id });
  const [row] = await db.select().from(artworks).where(eq(artworks.id, insertId(result))).limit(1);
  return row;
}

export async function deleteArtwork(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(artworks).where(and(eq(artworks.id, id), eq(artworks.userId, userId)));
}

// ─── Content Approvals (link de aprovação pra cliente final) ─────────────────

export async function createContentApproval(
  userId: number,
  contentType: "article" | "carousel",
  contentId: number,
  clientName?: string
): Promise<{ id: number; token: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { nanoid } = await import("nanoid");
  const token = nanoid(48);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [result] = await db.insert(contentApprovals).values({
    token,
    userId,
    contentType,
    contentId,
    clientName: clientName || null,
    expiresAt,
  }).returning({ id: contentApprovals.id });
  return { id: insertId(result), token };
}

export async function getContentApprovalByToken(token: string): Promise<ContentApproval | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(contentApprovals)
    .where(and(eq(contentApprovals.token, token), sql`"expiresAt" > NOW()`))
    .limit(1);
  return row ?? null;
}

export async function getLatestContentApproval(
  userId: number,
  contentType: "article" | "carousel",
  contentId: number
): Promise<ContentApproval | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(contentApprovals)
    .where(and(
      eq(contentApprovals.userId, userId),
      eq(contentApprovals.contentType, contentType),
      eq(contentApprovals.contentId, contentId)
    ))
    .orderBy(desc(contentApprovals.createdAt))
    .limit(1);
  return row ?? null;
}

export async function respondToContentApproval(
  token: string,
  status: "approved" | "changes_requested",
  comment?: string
): Promise<ContentApproval | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await getContentApprovalByToken(token);
  if (!existing) return null;

  await db.update(contentApprovals)
    .set({ status, clientComment: comment || null, respondedAt: new Date() })
    .where(eq(contentApprovals.token, token));

  return getContentApprovalByToken(token);
}
