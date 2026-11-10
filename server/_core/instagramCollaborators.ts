import { z } from "zod";

// Colaboradores de um post do Instagram (collab): até 3 @ de outros perfis.
// A Meta aceita em post de imagem, carrossel (no container principal) e Reels; não em Stories.
// O outro perfil recebe um convite e precisa aceitar no app para o post aparecer no perfil dele.

export const MAX_COLLABORATORS = 3;
const USERNAME_RE = /^[a-z0-9._]{1,30}$/;

/** "@AllpFit " → "allpfit" */
export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export const collaboratorsSchema = z
  .array(z.string())
  .max(MAX_COLLABORATORS, `No máximo ${MAX_COLLABORATORS} colaboradores por post.`)
  .transform((list) => [...new Set(list.map(normalizeUsername).filter(Boolean))])
  .refine((list) => list.every((u) => USERNAME_RE.test(u)), "Use só o @ do perfil (letras, números, ponto e _).")
  .optional();

/** Lê os colaboradores guardados no metadata (JSON) de uma postagem. */
export function collaboratorsFromMetadata(metadata?: string | null): string[] {
  if (!metadata?.trim()) return [];
  try {
    const list = (JSON.parse(metadata) as { collaborators?: unknown }).collaborators;
    return Array.isArray(list)
      ? list.map((u) => normalizeUsername(String(u))).filter((u) => USERNAME_RE.test(u)).slice(0, MAX_COLLABORATORS)
      : [];
  } catch {
    return [];
  }
}

/** Parâmetro `collaborators` da Graph API (lista em JSON), ou nada se não houver. */
export function collaboratorsParam(list?: string[]): Record<string, string> {
  return list?.length ? { collaborators: JSON.stringify(list) } : {};
}
