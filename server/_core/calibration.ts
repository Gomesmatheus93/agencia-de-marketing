import { getTopPerformanceForUser, getUserNicheForPerformance } from "../db";

const FORMAT_LABELS: Record<string, string> = {
  carousel: "carrossel",
  reels: "reels/vídeo curto",
  article: "artigo",
};

const HOOK_LABELS: Record<string, string> = {
  curiosity: "curiosidade",
  controversy: "polêmica",
  pain: "dor/problema",
  benefit: "benefício",
  story: "storytelling",
  data: "dado/estatística",
  question: "pergunta",
};

export async function getCalibrationBlock(userId: number, format: string): Promise<string> {
  try {
    const [topPerf, niche] = await Promise.all([
      getTopPerformanceForUser(userId, format),
      getUserNicheForPerformance(userId),
    ]);

    if (topPerf.length === 0) return "";

    const formatLabel = FORMAT_LABELS[format] ?? format;
    const best = topPerf[0];
    const topHook = HOOK_LABELS[best.hookType] ?? best.hookType;
    const topStyle = best.templateStyle ?? "padrão";
    const topSource = best.sourceKind === "radar" ? "tópico do Radar de Temas" : best.sourceKind === "insumo" ? "Insumo Universal" : "tema manual";

    const lines: string[] = [
      `=== CALIBRAÇÃO DE PERFORMANCE (nicho: ${niche}) ===`,
      `Com base nos ${format === "carousel" ? "carrosseis" : `${formatLabel}s`} com maior engajamento deste usuário:`,
      `- Melhor estilo visual: "${topStyle}" (score médio: ${best.avgScore}/100, ${best.postCount} posts)`,
      `- Hook que mais converte: ${topHook}`,
      `- Fonte de pauta com maior sucesso: ${topSource}`,
    ];

    if (topPerf.length > 1) {
      const second = topPerf[1];
      lines.push(`- 2º melhor estilo: "${second.templateStyle}" (score: ${second.avgScore}/100)`);
    }

    lines.push(
      `Priorize o estilo "${topStyle}" e hooks do tipo "${topHook}" nesta geração.`,
      `=== FIM DA CALIBRAÇÃO ===`
    );

    return lines.join("\n");
  } catch {
    return "";
  }
}
