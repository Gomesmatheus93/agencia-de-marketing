import Redis from "ioredis";

// Estado compartilhado entre réplicas do container. Sem REDIS_URL configurado,
// toda função aqui degrada graciosamente pro comportamento de instância única
// (rate limit em memória local, schedulers sempre "vencem" o lock) — então
// nada disso é obrigatório pra rodar localmente ou com 1 réplica só.

let _client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (_client !== undefined) return _client;

  if (!process.env.REDIS_URL) {
    _client = null;
    return _client;
  }

  try {
    _client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    _client.on("error", (err) => {
      console.warn("[Redis] Erro de conexão:", err.message);
    });
  } catch (err) {
    console.warn("[Redis] Falha ao inicializar cliente:", err);
    _client = null;
  }

  return _client;
}

// Janela fixa de contagem (INCR + PEXPIRE no primeiro incremento), compartilhada
// entre réplicas. Retorna null quando o Redis não está configurado ou falhou —
// nesse caso quem chamou deve cair pro fallback em memória.
export async function redisIncrWithTtl(key: string, ttlMs: number): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, ttlMs);
    return count;
  } catch (err) {
    console.warn(`[Redis] INCR '${key}' falhou, usando fallback em memória:`, (err as Error).message);
    return null;
  }
}

// Trava distribuída pros schedulers: só a réplica que conseguir o lock roda o
// ciclo. Sem Redis configurado (ou se o Redis falhar), sempre retorna true —
// fail-open, porque rodar em duplicidade uma vez é bem menos grave do que
// nenhuma réplica rodar nunca.
export async function acquireSchedulerLock(name: string, ttlMs: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;

  try {
    const result = await redis.set(`lock:scheduler:${name}`, "1", "PX", ttlMs, "NX");
    return result === "OK";
  } catch (err) {
    console.warn(`[Redis] Lock '${name}' falhou, executando localmente:`, (err as Error).message);
    return true;
  }
}
