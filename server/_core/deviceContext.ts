import { AsyncLocalStorage } from "node:async_hooks";

// ID do aparelho (pedido de 26/11/2026): o navegador não revela o endereço MAC, então cada
// navegador recebe um código aleatório num cookie (alle_device) e ele vai em todos os
// registros (audit_log.metadata.deviceId). Limpar os dados do navegador ou usar aba anônima
// gera um aparelho novo.

export const DEVICE_COOKIE_NAME = "alle_device";
export const DEVICE_ID_RE = /^[a-f0-9]{16}$/;

const store = new AsyncLocalStorage<{ deviceId: string }>();

/** Roda o resto da requisição com o ID do aparelho disponível para os registros. */
export function runWithDevice<T>(deviceId: string, fn: () => T): T {
  return store.run({ deviceId }, fn);
}

/** ID do aparelho da requisição atual (null fora de uma requisição, ex.: tarefas agendadas). */
export function currentDeviceId(): string | null {
  return store.getStore()?.deviceId ?? null;
}

/** Rótulo curto para a tela: "A3F9". */
export const deviceLabel = (id: string) => id.slice(0, 4).toUpperCase();
