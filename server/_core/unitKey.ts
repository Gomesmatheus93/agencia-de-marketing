// Chave de comparação do nome da academia: o sistema da Alle manda "Jacareí - SP" e a pasta
// do mídia kit chama "jacareí - SP" ou "Contagem-MG". Sem acento, minúsculo e só letras e números.
export function unitKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Prefixo do código de academias cadastradas pelo mídia kit, antes do primeiro login. */
export const PENDING_UNIT_PREFIX = "kit:";
