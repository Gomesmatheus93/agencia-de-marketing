import { ENV } from "./env";
import { invokeLLM } from "./llm";

const SEO_AGENT_PROMPT = `Voce e um Estrategista de SEO Senior com mais de 10 anos de experiencia em pesquisa de palavras-chave e estrategia de conteudo para agencias de marketing digital no Brasil.

Sua funcao e transformar uma palavra-chave semente e dados reais de busca (quando disponiveis) em uma estrategia de palavras-chave acionavel, agrupada por intencao de busca, com ideias de conteudo prontas para producao.

Regras:
- Baseie as recomendacoes nos dados de busca reais fornecidos (perguntas relacionadas, buscas relacionadas, resultados organicos) quando existirem.
- Quando nao houver dados reais, deixe claro que os volumes/dificuldade sao estimativas e nao numeros medidos.
- Distinga claramente a intencao de busca de cada palavra-chave: informational (aprender), commercial (comparar/pesquisar antes de comprar), transactional (pronto para agir), navigational (procurando uma marca/pagina especifica).
- Priorize palavras-chave com potencial real de trafego qualificado para o nicho informado, nao apenas volume.
- Cada ideia de conteudo deve indicar o formato mais adequado dentro do que a agencia ja produz: artigo, carrossel, reels, stories ou newsletter.
- Escreva tudo em portugues do Brasil, direto e sem enrolacao.
- Nao invente numeros de volume de busca precisos; use faixas qualitativas (alto/medio/baixo) quando nao houver dado real.`;

export type SeoKeywordAgentInput = {
  seedKeyword: string;
  companyName?: string;
  industry?: string;
  targetAudience?: string;
  market?: string;
};

export type SeoKeywordSuggestion = {
  term: string;
  priority: number;
  volumeHint: "alto" | "medio" | "baixo";
  difficultyHint: "alta" | "media" | "baixa";
  rationale: string;
};

export type SeoKeywordCluster = {
  intent: "informational" | "commercial" | "transactional" | "navigational";
  keywords: SeoKeywordSuggestion[];
};

export type SeoContentIdea = {
  title: string;
  targetKeyword: string;
  contentType: "artigo" | "carrossel" | "reels" | "stories" | "newsletter";
  funnelStage: "topo" | "meio" | "fundo";
  hook: string;
};

export type SeoKeywordAgentResult = {
  seedKeyword: string;
  usedRealSearchData: boolean;
  peopleAlsoAsk: string[];
  relatedSearches: string[];
  clusters: SeoKeywordCluster[];
  contentIdeas: SeoContentIdea[];
};

interface SerperOrganicResult {
  title?: string;
  snippet?: string;
  link?: string;
}

interface SerperSearchResponse {
  organic?: SerperOrganicResult[];
  peopleAlsoAsk?: Array<{ question?: string }>;
  relatedSearches?: Array<{ query?: string }>;
}

async function fetchSerperSearchData(seedKeyword: string): Promise<{
  organic: SerperOrganicResult[];
  peopleAlsoAsk: string[];
  relatedSearches: string[];
} | null> {
  if (!ENV.serperApiKey) return null;

  try {
    const resp = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": ENV.serperApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: seedKeyword, gl: "br", hl: "pt-br", num: 10 }),
    });

    if (!resp.ok) {
      console.warn(`[SeoKeywordAgent] Serper retornou ${resp.status} para "${seedKeyword}"`);
      return null;
    }

    const data = (await resp.json()) as SerperSearchResponse;

    return {
      organic: (data.organic ?? []).slice(0, 10),
      peopleAlsoAsk: (data.peopleAlsoAsk ?? [])
        .map((p) => p.question?.trim())
        .filter((q): q is string => Boolean(q)),
      relatedSearches: (data.relatedSearches ?? [])
        .map((r) => r.query?.trim())
        .filter((q): q is string => Boolean(q)),
    };
  } catch (err) {
    console.error(`[SeoKeywordAgent] Erro ao consultar Serper para "${seedKeyword}":`, err);
    return null;
  }
}

const KEYWORD_STRATEGY_SCHEMA = {
  type: "object",
  properties: {
    clusters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            enum: ["informational", "commercial", "transactional", "navigational"],
          },
          keywords: {
            type: "array",
            items: {
              type: "object",
              properties: {
                term: { type: "string" },
                priority: { type: "number" },
                volumeHint: { type: "string", enum: ["alto", "medio", "baixo"] },
                difficultyHint: { type: "string", enum: ["alta", "media", "baixa"] },
                rationale: { type: "string" },
              },
              required: ["term", "priority", "volumeHint", "difficultyHint", "rationale"],
              additionalProperties: false,
            },
          },
        },
        required: ["intent", "keywords"],
        additionalProperties: false,
      },
    },
    contentIdeas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          targetKeyword: { type: "string" },
          contentType: {
            type: "string",
            enum: ["artigo", "carrossel", "reels", "stories", "newsletter"],
          },
          funnelStage: { type: "string", enum: ["topo", "meio", "fundo"] },
          hook: { type: "string" },
        },
        required: ["title", "targetKeyword", "contentType", "funnelStage", "hook"],
        additionalProperties: false,
      },
    },
  },
  required: ["clusters", "contentIdeas"],
  additionalProperties: false,
} as const;

export async function researchKeywordsWithAgent(
  input: SeoKeywordAgentInput
): Promise<SeoKeywordAgentResult> {
  const searchData = await fetchSerperSearchData(input.seedKeyword);

  const contextLines = [
    `Palavra-chave semente: ${input.seedKeyword}`,
    input.companyName ? `Empresa: ${input.companyName}` : "",
    input.industry ? `Setor/nicho: ${input.industry}` : "",
    input.targetAudience ? `Publico-alvo: ${input.targetAudience}` : "",
    `Mercado: ${input.market ?? "Brasil"}`,
    "",
  ];

  if (searchData) {
    contextLines.push(
      "Dados reais coletados do Google (via Serper):",
      "",
      "Resultados organicos (titulo — trecho):",
      ...searchData.organic.map((r) => `- ${r.title ?? ""} — ${r.snippet ?? ""}`),
      "",
      "Perguntas relacionadas (People Also Ask):",
      ...searchData.peopleAlsoAsk.map((q) => `- ${q}`),
      "",
      "Buscas relacionadas:",
      ...searchData.relatedSearches.map((q) => `- ${q}`)
    );
  } else {
    contextLines.push(
      "Nenhum dado real de busca disponivel (SERPER_API_KEY nao configurado ou consulta falhou).",
      "Gere a analise com base no seu conhecimento sobre o setor, deixando claro nos rationale que sao estimativas."
    );
  }

  const response = await invokeLLM({
    messages: [
      { role: "system", content: SEO_AGENT_PROMPT },
      {
        role: "user",
        content: [
          contextLines.filter(Boolean).join("\n"),
          "",
          "Gere de 3 a 4 clusters de palavras-chave (um por intencao de busca relevante) com 3 a 5 palavras-chave cada,",
          "e de 4 a 6 ideias de conteudo prontas para producao, distribuidas entre os formatos disponiveis (artigo, carrossel, reels, stories, newsletter)",
          "e cobrindo topo, meio e fundo de funil.",
        ].join("\n"),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "seo_keyword_strategy",
        strict: true,
        schema: KEYWORD_STRATEGY_SCHEMA,
      },
    },
    max_tokens: 3000,
  });

  const rawContent = response.choices[0]?.message?.content;
  const parsed = JSON.parse(
    (typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent)) || "{}"
  ) as { clusters?: SeoKeywordCluster[]; contentIdeas?: SeoContentIdea[] };

  return {
    seedKeyword: input.seedKeyword,
    usedRealSearchData: Boolean(searchData),
    peopleAlsoAsk: searchData?.peopleAlsoAsk ?? [],
    relatedSearches: searchData?.relatedSearches ?? [],
    clusters: parsed.clusters ?? [],
    contentIdeas: parsed.contentIdeas ?? [],
  };
}
