// Lockout progressivo de login: conta tentativas falhas por e-mail (blind index)
// e por IP numa janela deslizante. Usa Redis quando disponível (compartilhado
// entre réplicas), senão cai pro Map em memória do processo.

import { redisDel, redisGetInt, redisIncr, redisPexpire } from "./redis";

const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_FAILS = 5;

type Entry = { count: number; resetAt: number };
const memory = new Map<string, Entry>();

function memGet(key: string): number {
  const e = memory.get(key);
  if (!e || Date.now() > e.resetAt) {
    memory.delete(key);
    return 0;
  }
  return e.count;
}

function memIncr(key: string): number {
  const now = Date.now();
  const e = memory.get(key);
  if (!e || now > e.resetAt) {
    memory.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return 1;
  }
  e.count += 1;
  return e.count;
}

setInterval(() => {
  const now = Date.now();
  Array.from(memory.entries()).forEach(([k, e]) => {
    if (now > e.resetAt) memory.delete(k);
  });
}, 5 * 60 * 1000).unref();

function keysFor(emailHash: string | null, ip: string): string[] {
  const keys = [`loginfail:ip:${ip}`];
  if (emailHash) keys.push(`loginfail:email:${emailHash}`);
  return keys;
}

/** Lança-nada; retorna true se o login deve ser bloqueado agora. */
export async function isLoginLocked(emailHash: string | null, ip: string): Promise<boolean> {
  for (const key of keysFor(emailHash, ip)) {
    const redisCount = await redisGetInt(key);
    const count = redisCount ?? memGet(key);
    if (count >= MAX_FAILS) return true;
  }
  return false;
}

export async function registerLoginFailure(emailHash: string | null, ip: string): Promise<void> {
  for (const key of keysFor(emailHash, ip)) {
    const redisCount = await redisIncr(key);
    if (redisCount === null) {
      memIncr(key);
    } else if (redisCount === 1) {
      await redisPexpire(key, WINDOW_MS);
    }
  }
}

export async function clearLoginFailures(emailHash: string | null, ip: string): Promise<void> {
  const keys = keysFor(emailHash, ip);
  await redisDel(...keys);
  keys.forEach((k) => memory.delete(k));
}

export const LOGIN_LOCK_MESSAGE =
  "Muitas tentativas de login. Aguarde 15 minutos antes de tentar de novo.";
