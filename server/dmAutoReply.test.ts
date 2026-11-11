import { describe, expect, it } from "vitest";
import { DEFAULT_FALLBACK, DEFAULT_RULES, decideDmReply, parseBillValue, type DmDecision } from "./dmAutoReply";

const settings = { rules: DEFAULT_RULES, flowEnabled: true, fallbackEnabled: true, fallbackMessage: DEFAULT_FALLBACK };

/** Simula uma conversa: cada mensagem decide com o histórico das respostas anteriores. */
function chat(messages: string[], opts = settings) {
  const history: Array<{ ruleKey: string; sentAt: Date }> = [];
  const replies: DmDecision[] = [];
  let now = Date.now();
  for (const m of messages) {
    now += 60_000;
    const d = decideDmReply(m, opts, [...history].reverse(), now);
    replies.push(d);
    if ("keys" in d) d.keys.forEach((ruleKey) => history.push({ ruleKey, sentAt: new Date(now) }));
  }
  return replies;
}
// O formato de moeda usa espaço não separável depois de "R$"; aqui compara com espaço normal.
const text = (d: DmDecision) => ("message" in d ? d.message.replace(/\u00a0/g, " ") : `[sem resposta: ${d.skip}]`);

describe("parseBillValue", () => {
  it.each([
    ["350", 350], ["uns 400 reais", 400], ["R$ 1.200,50", 1200.5], ["1200", 1200],
    ["2 mil", 2000], ["R$350,00", 350], ["vem 89,90", 89.9], ["minha conta é 1.350", 1350],
  ])("%s → %d", (input, expected) => expect(parseBillValue(input)).toBe(expected));
  it("ignora mensagens sem valor", () => expect(parseBillValue("não sei ao certo")).toBeNull());
});

describe("fluxo em etapas", () => {
  it("cumprimenta, pergunta o valor e manda pro WhatsApp quando passa de R$ 200", () => {
    const [start, result] = chat(["oi", "uns 350"]);
    expect(text(start)).toContain("qual é o valor aproximado");
    expect(text(result)).toContain("R$ 350,00");
    expect(text(result)).toContain("{link}");
    expect(text(result)).not.toMatch(/\d+%/);
  });

  it("avisa o mínimo abaixo de R$ 200", () => {
    const [, result] = chat(["olá", "150"]);
    expect(text(result)).toContain("abaixo do mínimo");
  });

  it("confirma valor muito alto e aceita o 'sim'", () => {
    const [, confirm, result] = chat(["oi", "5000", "sim"]);
    expect(text(confirm)).toContain("erro de digitação");
    expect(text(result)).toContain("R$ 5.000,00");
    expect(text(result)).toContain("pode ter desconto");
  });

  it("tira a dúvida e retoma a pergunta do valor", () => {
    const [, doubt, result] = chat(["oi", "tem fidelidade?", "400"]);
    expect(text(doubt)).toContain("sem fidelidade");
    expect(text(doubt)).toContain("Com isso esclarecido");
    expect(text(result)).toContain("R$ 400,00");
  });

  it("pergunta de novo uma vez e depois manda a resposta padrão", () => {
    const [, reask, fallback, after] = chat(["oi", "hmm", "ok obrigado", "tchau"]);
    expect(text(reask)).toContain("por exemplo: 350");
    expect(text(fallback)).toContain("WhatsApp");
    expect(text(after)).toContain("sem resposta: cooldown");
  });

  it("'não quero desconto' cai em desinteresse, não em desconto", () => {
    const [reply] = chat(["não quero desconto"]);
    expect(text(reply)).toContain("Entendo o receio");
    expect(text(reply)).not.toContain("Com isso esclarecido");
  });

  it("fatura e documentos vão para o WhatsApp", () => {
    const [reply] = chat(["posso mandar a fatura por aqui?"]);
    expect(text(reply)).toContain("{link}");
  });

  it("nenhuma resposta padrão menciona porcentagem nem promessa sem dado", () => {
    const all = [...DEFAULT_RULES.map((r) => r.reply), DEFAULT_FALLBACK].join(" ");
    expect(all).not.toMatch(/\d+\s*%/);
    expect(all).not.toMatch(/milhares|vagas|100% solar|certificada/i);
  });
});

describe("sem o fluxo", () => {
  it("responde só por palavra-chave e não pergunta o valor", () => {
    const [reply] = chat(["como funciona?"], { ...settings, flowEnabled: false });
    expect(text(reply)).toContain("placas solares");
    expect(text(reply)).not.toContain("valor aproximado");
  });
});
