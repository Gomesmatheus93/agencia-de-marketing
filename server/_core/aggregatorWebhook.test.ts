import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../db", () => ({
  getActiveDigestSession: vi.fn(),
  saveDigestSession: vi.fn(),
  recordSessionResponse: vi.fn(),
  getUserDigestSettings: vi.fn().mockResolvedValue(null),
}));

vi.mock("./whatsapp", () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({ messageId: "wamid.test" }),
}));

vi.mock("./newsDigestScheduler", () => ({
  fetchMoreNews: vi.fn(),
}));

vi.mock("./newsAutoGenerator", () => ({
  autoGenerateFromNews: vi.fn(),
}));

vi.mock("./env", () => ({
  ENV: { appBaseUrl: "https://krythoslab.com" },
}));

import * as db from "../db";
import { sendWhatsAppText } from "./whatsapp";
import { fetchMoreNews } from "./newsDigestScheduler";
import { handleAggregatorWebhook, wantsMoreNews, buildDigestTextMessage } from "./aggregatorWebhook";

function makeReqRes(body: unknown) {
  const req = { body } as Request;
  const jsonMock = vi.fn();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
  const res = { status: statusMock, json: jsonMock } as unknown as Response;
  return { req, res, jsonMock, statusMock };
}

const SAMPLE_NEWS = [
  { title: "Notícia A sobre energia solar", url: "https://example.com/a", source: "Canal Solar", excerpt: "Resumo A", publishedAt: null },
  { title: "Notícia B sobre eólica", url: "https://example.com/b", source: "Canal Energia", excerpt: "Resumo B", publishedAt: null },
];

const MORE_NEWS = [
  { title: "Notícia C nova", url: "https://example.com/c", source: "Eixos", excerpt: "Resumo C", publishedAt: null },
  { title: "Notícia D nova", url: "https://example.com/d", source: "PV Magazine", excerpt: "Resumo D", publishedAt: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wantsMoreNews", () => {
  it.each([
    "0", "mais", "outra", "outras", "outro", "outros",
    "mais noticias", "mais notícias", "outras noticias",
    "não gostei", "nao gostei", "não gostei de nenhuma",
    "nenhuma", "nenhuma dessas",
    "não", "nao", "refresh", "trocar", "mudar",
    "  trocar  ", "MAIS", "Não Gostei",
  ])("recognizes trigger phrase: %j", (phrase) => {
    expect(wantsMoreNews(phrase)).toBe(true);
  });

  it.each(["1", "2", "3", "4", "5", "oi", "obrigado", "quero a segunda"])(
    "does not treat normal reply as a trigger: %j",
    (phrase) => {
      expect(wantsMoreNews(phrase)).toBe(false);
    }
  );
});

describe("handleAggregatorWebhook — more news trigger", () => {
  it("fetches and resends when an active session exists", async () => {
    vi.mocked(db.getActiveDigestSession).mockResolvedValue({
      userId: 42,
      newsItems: SAMPLE_NEWS,
    });
    vi.mocked(fetchMoreNews).mockResolvedValue(MORE_NEWS);
    vi.mocked(db.saveDigestSession).mockResolvedValue({ id: 99, campaignId: "camp_test" });

    const { req, res, statusMock, jsonMock } = makeReqRes({
      from: "5511999998888",
      message: "não gostei de nenhuma",
    });

    await handleAggregatorWebhook(req, res);

    expect(db.getActiveDigestSession).toHaveBeenCalledWith("5511999998888");
    expect(fetchMoreNews).toHaveBeenCalledTimes(1);
    const excludedArg = vi.mocked(fetchMoreNews).mock.calls[0][0] as Set<string>;
    expect(excludedArg.has("https://example.com/a")).toBe(true);
    expect(excludedArg.has("https://example.com/b")).toBe(true);

    expect(db.saveDigestSession).toHaveBeenCalledWith(42, "5511999998888", MORE_NEWS);

    // Sent text must match the original template format: title + fonte + link (short link built from the new session id)
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "5511999998888",
      expect.stringContaining("Notícia C nova")
    );
    const sentText = vi.mocked(sendWhatsAppText).mock.calls[0][1];
    expect(sentText).toContain("Eixos");
    expect(sentText).toContain("https://krythoslab.com/n/99/0");
    expect(sentText).toContain("PV Magazine");
    expect(sentText).toContain("https://krythoslab.com/n/99/1");

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resposta_texto: expect.stringContaining("Notícia D nova"),
        telefone: "5511999998888",
        noticia_selecionada: null,
      })
    );
  });

  it("replies with 'sem sessão' and skips fetchMoreNews when there is no active session", async () => {
    vi.mocked(db.getActiveDigestSession).mockResolvedValue(null);

    const { req, res, jsonMock } = makeReqRes({
      from: "5511999998888",
      message: "trocar",
    });

    await handleAggregatorWebhook(req, res);

    expect(fetchMoreNews).not.toHaveBeenCalled();
    expect(db.saveDigestSession).not.toHaveBeenCalled();
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "5511999998888",
      expect.stringContaining("Não encontramos um envio recente")
    );
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ erro: expect.stringContaining("Nenhuma sessão ativa") })
    );
  });

  it("apologizes and does not save a session when no fresh news are found", async () => {
    vi.mocked(db.getActiveDigestSession).mockResolvedValue({
      userId: 42,
      newsItems: SAMPLE_NEWS,
    });
    vi.mocked(fetchMoreNews).mockResolvedValue([]);

    const { req, res, jsonMock } = makeReqRes({
      from: "5511999998888",
      message: "outras",
    });

    await handleAggregatorWebhook(req, res);

    expect(db.saveDigestSession).not.toHaveBeenCalled();
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "5511999998888",
      expect.stringContaining("Não encontrei outras notícias")
    );
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ erro: expect.stringContaining("Nenhuma notícia nova") })
    );
  });
});

describe("handleAggregatorWebhook — regression on existing behavior", () => {
  it("still asks for a 1-5 reply on unrelated text", async () => {
    const { req, res, jsonMock } = makeReqRes({
      from: "5511999998888",
      message: "oi tudo bem?",
    });

    await handleAggregatorWebhook(req, res);

    expect(db.getActiveDigestSession).not.toHaveBeenCalled();
    expect(fetchMoreNews).not.toHaveBeenCalled();
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "5511999998888",
      expect.stringContaining("número de *1 a 5*")
    );
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ erro: expect.stringContaining("Resposta inválida") })
    );
  });

  it("still handles a valid 1-5 choice without an active session as before", async () => {
    vi.mocked(db.recordSessionResponse).mockResolvedValue(null);

    const { req, res, jsonMock } = makeReqRes({
      from: "5511999998888",
      message: "3",
    });

    await handleAggregatorWebhook(req, res);

    expect(db.recordSessionResponse).toHaveBeenCalledWith("5511999998888", 3);
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "5511999998888",
      expect.stringContaining("Não encontramos um envio recente")
    );
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ erro: expect.stringContaining("Nenhuma sessão ativa") })
    );
  });
});

describe("buildDigestTextMessage", () => {
  it("numbers up to 5 items with emoji and a custom header", () => {
    const text = buildDigestTextMessage(MORE_NEWS, "🔄 *Outras Notícias*");
    expect(text).toContain("🔄 *Outras Notícias*");
    expect(text).toContain("1️⃣ Notícia C nova");
    expect(text).toContain("2️⃣ Notícia D nova");
  });

  it("includes source and link per item, like the original template", () => {
    const text = buildDigestTextMessage([
      { title: "Título X", source: "Canal Solar", url: "https://krythoslab.com/n/1/0" },
    ]);
    expect(text).toContain("1️⃣ Título X");
    expect(text).toContain("Canal Solar");
    expect(text).toContain("https://krythoslab.com/n/1/0");
  });

  it("omits source/link lines when not provided", () => {
    const text = buildDigestTextMessage([{ title: "Só título" }]);
    const itemBlock = text.split("\n\n")[1];
    expect(itemBlock).toBe("1️⃣ Só título");
  });
});
