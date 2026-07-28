import { randomUUID } from "node:crypto";
import { generateImage } from "./imageGeneration";
import {
  invokeAnthropicLLM,
  parseClaudeJsonResponse,
  buildAnthropicImageContent,
  type AnthropicContent,
} from "./anthropicClient";
import { ENV } from "./env";
import { storagePut } from "../storage";
import {
  type CarouselContentPayload,
  resolveBlockBody,
} from "./carouselContentSchema";

// ─── Profile contexts ─────────────────────────────────────────────────────────

const PROFILE_CONTEXTS: Record<string, string> = {
  flavio: `Perfil: Flávio Vasconcelos (@comflavio). Visual premium em azul-marinho (#0f172a) com acentos dourados (#c9a227) e azul vibrante (#2196F3). Tom: inspirador, direto, autoridade em coaching e liderança. Sem gírias. Frases curtas e impactantes. Público: empreendedores e líderes. PROIBIDO: clichês de autoajuda, linguagem casual, emojis.`,
  krythos: `Perfil: KrythosLab (@krythoslab). Visual tech dark: fundo preto (#0d1117), acentos ciano neon (#29d9ff). Tom: técnico, inovador, direto. Linguagem de agência digital criativa. Pode usar termos em inglês quando pertinente. Público: founders, devs, designers e profissionais de marketing digital. PROIBIDO: linguagem muito formal, termos genéricos sem substância.`,
  "alle-laranja": `Perfil: Alle Energia (@alleenergia). Visual em laranja vibrante (#F47B20) com formas dinâmicas e bold. Tom: próximo, acessível, econômico. Destaca benefícios práticos na conta de luz. Linguagem simples para o consumidor médio. Público: donos de imóvel, pequenos empresários. PROIBIDO: jargão técnico, linguagem muito formal.`,
  "alle-roxo": `Perfil: Alle Energia (@alleenergia) — variante premium. Visual em roxo intenso (#7B2FBE) com acentos laranja. Tom: confiável, moderno, premium. Destaca credibilidade e inovação. Público: empresas médias e grandes, tomadores de decisão em energia. PROIBIDO: linguagem muito popular, imprecisão técnica.`,
  "alle-minimalista": `Perfil: Alle Energia Minimalista (@alleenergia). Use o mesmo layout editorial minimalista do modelo Claude Minimalista, adaptado para a marca Alle Energia. Paleta obrigatoria: fundo roxo escuro #44015e, paines/areas de apoio em #7c00ae, acentos em laranja #ff6600 e texto branco #ffffff. Composicao centrada, limpa, premium e com muito respiro. Primeiro slide com imagem destacada e titulo forte em caixa alta. Slides internos com titulo centralizado, texto curto e bloco visual limpo. Ultimo slide com CTA elegante e direto. Tom: confiavel, estrategico, claro e comercial. Frases curtas. Sem emojis. PROIBIDO: excesso de texto, floreios visuais, jargao tecnico desnecessario, degrades chamativos fora da paleta e promessas vagas.`,
  "claude-minimalista": `Perfil: Claude Minimalista (@claude.design). Visual editorial minimalista inspirado em ferramentas premium de carrossel: fundo preto absoluto (#050505), molduras cinza-escuro, tipografia branca bold, composicao centrada e muito respiro. Primeiro slide com imagem destacada no topo e titulo forte em caixa alta. Slides internos com titulo centralizado, texto curto e bloco visual limpo. Ultimo slide com CTA elegante e direto. Tom: estrategico, seco, confiante e rapido. Frases curtas. Sem emojis. PROIBIDO: excesso de texto, floreios visuais, jargao vazio, degrades chamativos e promessas genericas.`,
  "brandsdecoded-claude": `Perfil: BrandsDecoded Claude (@brandsdecoded). Sistema editorial inspirado na comunicacao publica da BrandsDecoded: copy provocadora, autoridade imediata, headlines memoraveis e estetica premium. Visual base: fundo preto ou quase preto, tipografia branca bold, acentos quentes discretos, composicao limpa e alto contraste. O conteudo deve parecer diagnostico de mercado, nao post motivacional. Frases curtas, tensao real, clareza comercial. Priorize ganchos que parem o scroll e slides com progressao estrategica. Quando o tema vier de noticia, transforme o fato em leitura de negocio ou oportunidade concreta. Sem emojis. PROIBIDO: linguagem coach, generica ou vazia; excesso de texto; promessas vagas; frases mornas; cliches de marketing.`,
};

const BRANDSDECODED_PROFILE_ID = "brandsdecoded-claude";

const DESIGNER_AGENT_SYSTEM_PROMPT = `
Você é um Agente Designer Sênior da agência KrythosLab, especializado em carrosséis profissionais para Instagram otimizados para o algoritmo.

Sua missão é transformar um template base em um carrossel visualmente natural, estratégico e profissional — e que maximize alcance orgânico no Instagram.

━━ ALGORITMO DO INSTAGRAM 2026 — REGRAS OBRIGATÓRIAS ━━

ESTRUTURA DE SLIDES (5 a 10 slides — range suportado; 7-10 é o ótimo para engajamento):
• Slide 1 — PERGUNTA-GANCHO OBRIGATÓRIO: SEMPRE use formato de pergunta direta (ex: "Qual desses 5 erros você comete?", "Por que sua conta de luz ainda é alta?", "Você está perdendo dinheiro sem saber?"). Compreendido em menos de 0,7 segundos. Máximo 10-12 palavras. Cria lacuna de informação. NUNCA entregue a resposta no slide 1. É o slide mais importante — carrega 80% do desempenho.
• Slides 2-N-2 — DESENVOLVIMENTO: 1 ideia por slide, máximo 15 palavras por slide, espaço generoso, progressão lógica. DENSIDADE INFORMACIONAL ALTA — cada slide deve conter dado, fato, contraste ou insight específico e real. Slides genéricos "de enchimento" são estritamente proibidos.
• Slide N-1 — RESUMO SALVÁVEL: checklist numerado, framework visual ou síntese em tópicos de alto contraste. Projetado para ser screenshot e salvo isoladamente — este slide gera salvamentos. Deve ser o slide mais "printable" do carrossel.
• Slide N — CTA DE SALVAMENTO: peça EXPLICITAMENTE que o usuário salve o post com motivo concreto ("Salva esse carrossel pra consultar quando precisar de X"). Alternativamente: compartilhamento com motivo específico. NUNCA peça curtida — é o sinal mais fraco do algoritmo.

SINAIS DE ENGAJAMENTO (do mais ao menos importante para o algoritmo):
1. Compartilhamentos via DM → design e conteúdo "que preciso mandar pra alguém"
2. Salvamentos → conteúdo de referência: checklists, guias, dados
3. Comentários → feche com pergunta aberta ou afirmação polarizante
4. Curtidas → o sinal mais fraco; não otimize apenas para isso

LEGENDA (caption) — ESTRUTURA OBRIGATÓRIA (SEO SOCIAL PRIMEIRO):
• Linha 1-2 (visíveis antes do "ver mais"): GANCHO de 5-10 palavras — pergunta, dado chocante ou afirmação ousada. SEM emoji na primeira linha.
• Desenvolvimento: 3-5 frases curtas, parágrafos de 1-2 linhas, emojis como separadores estruturais. DISTRIBUA 2-3 KEYWORDS PRIMÁRIAS do tema naturalmente no corpo do texto — o algoritmo do Instagram indexa o texto da legenda para busca semântica (impacto de descoberta 3x maior que hashtags). Prefira termos que o público usaria ao buscar o tema.
• Feche com UM CTA específico — peça salvamento ("Salva pra consultar quando precisar de X") ou compartilhamento. NUNCA peça curtida.
• Tamanho ideal para salvamentos/autoridade: 800-1500 caracteres.

HASHTAGS — MÁXIMO 3-5 (Instagram 2026):
• Use no máximo 3-5 hashtags — de preferência apenas 3. Nunca mais.
• Composição: 1-2 de nicho específico (50K-500K posts) + 1 de tópico amplo. Evite hashtags genéricas e sem volume real.
• KEYWORDS NO CORPO DO TEXTO têm maior impacto de descoberta que hashtags. Nunca substitua keywords por hashtags.

━━ REGRAS DE DESIGN ━━
1. Não copie o template rigidamente — use como referência de estilo e intenção visual.
2. Preservar identidade visual: cores, hierarquia, ritmo.
3. Máximo 3 linhas de texto por slide (ideal: 1-2).
4. Fundo escuro supera fundo claro em taxa de salvamento.
5. Slide penúltimo (resumo): alto contraste, muito legível, "screenshot-worthy".
6. Nunca sobrecarregue com texto.
7. Reescreva textos fracos para versões mais claras e persuasivas.

COMPORTAMENTO:
- Pense como designer, copywriter e social media sênior que conhece o algoritmo.
- Entregue algo pronto para produção.
- Quando faltar informação, assuma uma solução profissional.

PROIBIDO nos textos: "Você sabia?", "No mundo atual", "Em um cenário cada vez mais digital", clichês genéricos de autoajuda, CTA pedindo curtida.

Quando existir template visual enviado, preserve essa família visual como referência.
Quando receber "=== Pesquisa sobre o tema ===", use os dados para enriquecer slides. Incorpore naturalmente, sem citar fonte.

Retorne APENAS o JSON abaixo, sem texto antes ou depois:
{
  "carouselTitle": "título interno descritivo",
  "caption": "legenda completa para o post no Instagram",
  "imageSearchQuery": "3 a 8 palavras em inglês para buscar imagem editorial do tema central",
  "hashtags": ["hashtag1", "hashtag2"],
  "cta": "chamada para ação final",
  "slides": [
    {
      "id": 1,
      "type": "hook",
      "title": "título curto do slide",
      "text": "texto principal do slide (até 150 chars)",
      "shortText": "Para o slide CTA: botão de ação específico e direto relacionado ao tema (ex: 'Me conta nos comentários!', 'Qual é o seu favorito?', 'Salva pra não esquecer'). Para outros slides: versão ultra-resumida (até 50 chars).",
      "imagePrompt": "detailed English prompt for the slide hero image — lighting, composition, mood",
      "backgroundPrompt": "English prompt for slide background — gradient, texture or photo",
      "visualDirection": "explicação curta do visual esperado para o designer",
      "layoutNotes": "observações de layout",
      "imageSearchQuery": "4 a 10 palavras em inglês para buscar imagem deste slide",
      "highlightWords": ["palavra-chave1", "palavra-chave2"],
      "editableFields": { "title": true, "text": true, "image": true, "background": true, "cta": false }
    }
  ],
  "generalDesignRules": ["regra geral 1"],
  "qualityChecklist": {
    "textsFitTemplate": true,
    "strongHook": true,
    "clearProgression": true,
    "profileToneRespected": true,
    "formatRespected": true,
    "editableOutput": true
  }
}
`;

// ─── Content Agent System Prompt (Fase 1) ────────────────────────────────────
// Substitui DESIGNER_AGENT_SYSTEM_PROMPT na geração principal.
// Retorna blocos semânticos independentes de template visual.

const CONTENT_AGENT_SYSTEM_PROMPT = `
Você é um Agente de Conteúdo Sênior da KrythosLab, especializado em carrosséis para Instagram.

Sua missão: gerar conteúdo estratégico estruturado — independente de template visual. O design será aplicado separadamente.

━━ ALGORITMO DO INSTAGRAM 2026 — REGRAS OBRIGATÓRIAS ━━

ESTRUTURA DE BLOCOS (5 a 10 — 7-10 é o ótimo para engajamento):
• Bloco 1 (type: "hook") — PERGUNTA-GANCHO OBRIGATÓRIA: sempre formato de pergunta direta. Máximo 10-12 palavras. Cria lacuna de informação. NUNCA entregue a resposta no bloco 1. É o bloco mais importante — carrega 80% do desempenho.
• Blocos 2..N-2 — escolha o tipo pelo conteúdo:
  - "stat": quando tiver dado numérico (ex: "38% das famílias...", "R$2.400 ao ano"). Preencha value + label.
  - "list_item": para checklist, dicas enumeradas, frameworks. Preencha items[] com máx 6 tópicos curtos.
  - "quote": para depoimento, citação ou afirmação de autoridade. Coloque em body.
  - "comparison": para contraste antes × depois, opção A × B. Preencha compareA + compareB.
  DENSIDADE INFORMACIONAL ALTA — cada bloco deve conter dado, fato, contraste ou insight específico. Blocos genéricos ("é importante...", "precisa de atenção...") são PROIBIDOS.
• Bloco N-1 (type: "list_item") — RESUMO SALVÁVEL: checklist numerado ou síntese em tópicos de alto contraste. Projetado para screenshot isolado — este bloco gera salvamentos.
• Bloco N (type: "cta") — CTA DE SALVAMENTO: peça EXPLICITAMENTE que o usuário salve com motivo concreto. NUNCA peça curtida.

SINAIS DE ENGAJAMENTO (do mais ao menos importante para o algoritmo):
1. Compartilhamentos via DM → conteúdo "que preciso mandar pra alguém"
2. Salvamentos → conteúdo de referência: checklists, guias, dados
3. Comentários → feche com pergunta aberta ou afirmação polarizante
4. Curtidas → o sinal mais fraco; não otimize apenas para isso

LEGENDA — ESTRUTURA OBRIGATÓRIA:
• Linha 1 (visível antes do "ver mais"): GANCHO de 5-10 palavras. SEM emoji na primeira linha.
• Desenvolvimento: parágrafos de 1-2 linhas, emojis como separadores. OBRIGATÓRIO: distribua 2-3 keywords primárias do tema (indexadas pelo Instagram — 3x mais impacto de descoberta que hashtags).
• Feche com UM CTA específico: peça salvamento ou compartilhamento. NUNCA peça curtida.
• Tamanho ideal: 800-1500 caracteres.

HASHTAGS — MÁXIMO 3-5: prefira 3. Nunca mais. 1-2 de nicho (50K-500K posts) + 1 ampla.

IMAGE SLOTS — defina imageSlot para orientar geração de imagem por IA:
• "hero" — imagem editorial principal (use no bloco 1)
• "background" — textura ou foto de fundo
• "portrait" — retrato humano contextualizado
• "product" — produto ou equipamento central
• "data_visual" — gráfico, número visual, infográfico
• "abstract" — composição abstrata, símbolo, textura premium

PROIBIDO: "Você sabia?", "No mundo atual", clichês de autoajuda, pedir curtida.

Retorne APENAS o JSON abaixo, sem texto antes ou depois:
{
  "carouselTitle": "título interno descritivo",
  "caption": "legenda completa para Instagram (800-1500 chars)",
  "imageSearchQuery": "3-8 English words for editorial photo of the central theme",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "cta": "chamada para ação final",
  "blocks": [
    {
      "type": "hook | list_item | stat | quote | comparison | cta",
      "title": "título curto (máx 12 palavras para hook, 8 para demais)",
      "body": "texto principal (≤150 chars) — use para hook/quote/cta ou como fallback",
      "value": "para type=stat: o número/métrica (ex: '38%', 'R$ 2.400')",
      "label": "para type=stat: o que essa métrica representa",
      "items": ["para type=list_item: tópicos curtos, máx 6"],
      "compareA": "para type=comparison: lado A (antes / opção ruim)",
      "compareB": "para type=comparison: lado B (depois / opção melhor)",
      "imageSlot": "hero | background | portrait | product | data_visual | abstract",
      "imagePrompt": "detailed English prompt for AI image generation — lighting, composition, mood",
      "imageSearchQuery": "4-10 English words for stock photo search for this block",
      "highlightWords": ["palavra-chave1", "palavra-chave2"]
    }
  ]
}
`;

// ─── Topic Research (Serper — Google Search) ─────────────────────────────────

type SerperOrganicResult = {
  title?: string;
  snippet?: string;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
  answerBox?: { answer?: string; snippet?: string; title?: string };
  knowledgeGraph?: { description?: string; title?: string };
};

type SerperImageResult = {
  title?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  thumbnailUrl?: string;
  source?: string;
};

type SerperImagesResponse = {
  images?: SerperImageResult[];
};

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function researchTopicContext(topic: string): Promise<string | null> {
  if (!ENV.serperApiKey) return null;

  try {
    const res = await fetchWithTimeout(
      "https://google.serper.dev/search",
      {
        method: "POST",
        headers: {
          "X-API-KEY": ENV.serperApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: topic, gl: "br", hl: "pt", num: 6 }),
      },
      3000
    );
    if (!res.ok) return null;

    const data = (await res.json()) as SerperResponse;
    const parts: string[] = [];

    // Answer box ou Knowledge Graph têm o melhor resumo direto
    const directAnswer =
      data.answerBox?.answer ||
      data.answerBox?.snippet ||
      data.knowledgeGraph?.description;
    if (directAnswer) {
      parts.push(`Resumo: ${directAnswer.replace(/\n/g, " ").trim()}`);
    }

    // Top resultados orgânicos
    const organic = (data.organic ?? [])
      .slice(0, 5)
      .map((r) => {
        const title = r.title?.trim() ?? "";
        const snippet = r.snippet?.replace(/\n/g, " ").trim() ?? "";
        return title && snippet ? `• ${title}: ${snippet}` : snippet || title;
      })
      .filter(Boolean);

    parts.push(...organic);

    if (parts.length === 0) return null;

    return `[Google — "${topic}"]\n${parts.join("\n")}`;
  } catch {
    return null;
  }
}

async function searchSerperImages(query: string): Promise<string | undefined> {
  if (!ENV.serperApiKey) return undefined;
  // Try up to 2 query variants: original, then a shorter fallback
  const queries = [query, query.split(" ").slice(0, 3).join(" ")].filter(Boolean);
  for (const q of queries) {
    try {
      const res = await fetchWithTimeout(
        "https://google.serper.dev/images",
        {
          method: "POST",
          headers: { "X-API-KEY": ENV.serperApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q, num: 20 }),
        },
        7000
      );
      if (!res.ok) continue;
      const data = (await res.json()) as SerperImagesResponse;
      const images = (data.images ?? []).filter((img) => {
        if (!img.imageUrl) return false;
        // Skip strongly landscape images (bad for portrait carousel)
        if (img.imageWidth && img.imageHeight && img.imageWidth > img.imageHeight * 1.4) return false;
        return true;
      });
      const portrait = images.filter(
        (img) => !img.imageWidth || !img.imageHeight || img.imageHeight >= img.imageWidth
      );
      const pool = portrait.length > 0 ? portrait : images;
      const result = pickRandom(pool, 8)?.imageUrl;
      if (result) return result;
    } catch {
      continue;
    }
  }
  return undefined;
}

// ─── Style Guide ──────────────────────────────────────────────────────────────

const STYLE_GUIDE: Record<string, string> = {
  signature: "Visual premium, contrastado e moderno, com atmosfera roxa profunda e acentos laranja vibrantes.",
  minimal: "Visual limpo, elegante e direto ao ponto.",
  bold: "Visual forte, marcante e com frases de impacto.",
  gradient: "Visual moderno, energico e com sensacao de movimento.",
  corporate: "Visual profissional, confiavel e orientado a autoridade.",
  vibrant: "Visual vibrante, expansivo e com bastante energia.",
  dark: "Visual sofisticado, contrastado e mais dramatico.",
};

const FALLBACK_CTA = "Salve este carrossel e compartilhe com quem precisa ver isso hoje.";

function getProfileGenerationBlueprint(input: {
  profileId?: string;
  articleBased?: boolean;
  slideCount: number;
}) {
  if (input.profileId !== BRANDSDECODED_PROFILE_ID) return "";

  const lastDevelopmentSlide = Math.max(2, input.slideCount - 1);
  const developmentRange =
    input.slideCount > 2
      ? `Slides 2 a ${lastDevelopmentSlide}`
      : "Slides internos";
  const sourceInstruction = input.articleBased
    ? "Quando houver noticia ou artigo, nao reescreva a manchete. Reenquadre o fato como impacto real para o leitor: o que mudou, por que importa, quem perde ignorando isso e qual movimento faz sentido agora."
    : "Quando o tema for livre, transforme o assunto em uma tese clara de mercado, comportamento ou oportunidade. Evite tratar o assunto como lista escolar.";

  return [
    "Framework BrandsDecoded (inferido publicamente): carrossel de autoridade, copy provocadora e estetica premium.",
    "Cada slide deve defender uma unica ideia forte. Corte qualquer linha que nao aumente tensao, clareza ou autoridade.",
    "Slide 1: hook de tensao, contraste, diagnostico ou reframe. Prefira estruturas como 'o erro', 'a verdade', 'enquanto voce...', 'o que mudou', 'por que ...'.",
    `${developmentRange}: siga a progressao diagnostico -> causa ou mecanismo -> implicacao, prova ou oportunidade -> orientacao pratica.`,
    "Ultimo slide: CTA curto, direto e elegante. Priorize salvar, compartilhar, comentar ou chamar no direct quando fizer sentido.",
    sourceInstruction,
    "Prefira palavras concretas, verbos fortes e leitura de operador experiente. Nunca soe como social media generico.",
    "Proibido: abertura tipo 'voce sabia?', frases motivacionais, jargao sem prova, enrolacao ou conselhos obvios.",
  ].join("\n");
}

function getProfileRegenBlueprint(input: {
  profileId?: string;
  slideType: "hook" | "development" | "cta";
}) {
  if (input.profileId !== BRANDSDECODED_PROFILE_ID) return "";

  const slideSpecificInstruction =
    input.slideType === "hook"
      ? "Este slide precisa abrir com uma tese memoravel e tensionada. A headline deve soar como algo que um operador experiente publicaria, nao como texto de copy generica."
      : input.slideType === "cta"
        ? "Este slide precisa fechar o raciocinio com uma acao clara e elegante. Nada de CTA infantil ou desesperado."
        : "Este slide deve aprofundar o raciocinio com diagnostico, mecanismo, prova, impacto ou oportunidade concreta.";

  return [
    "Mantenha o estilo BrandsDecoded: autoridade imediata, copy provocadora e pouca gordura verbal.",
    slideSpecificInstruction,
    "Seja especifico, direto e comercial sem perder elegancia.",
  ].join("\n");
}

function getProfileCaptionBlueprint(profileId?: string) {
  const brandedExtra =
    profileId === BRANDSDECODED_PROFILE_ID
      ? "\nEstilo editorial BrandsDecoded: tese forte ou reframe, blocos curtos com causa/impacto/conclusão prática, tom afiado e humano."
      : "";

  return [
    "LEGENDA — ESTRUTURA OBRIGATÓRIA (SEO SOCIAL PRIMEIRO):",
    "• Linha 1 (gancho antes do 'ver mais'): 5-10 palavras impactantes — dado chocante, pergunta provocadora ou afirmação ousada. SEM emoji na primeira linha.",
    "• Desenvolvimento: parágrafos de 1-2 linhas, emojis como separadores. OBRIGATÓRIO: distribua 2-3 keywords primárias do tema naturalmente no corpo do texto (ex: se o tema é sobre energia solar, use 'energia solar', 'conta de luz', 'painel fotovoltaico' nas frases). Estas keywords são indexadas pelo Instagram para busca semântica — têm 3x mais impacto de descoberta que hashtags.",
    "• Feche com UM CTA específico: peça salvamento ('Salva pra consultar quando precisar de X') ou compartilhamento ('Manda pra quem precisa ver isso'). NUNCA peça curtida — é o sinal mais fraco do algoritmo.",
    "• Máximo 3-5 hashtags ao final — de preferência 3. Priorize nichos de 50K-500K posts. Nunca mais que 5.",
    "• Tamanho ideal: 800-1500 caracteres para gerar salvamentos e autoridade.",
    brandedExtra,
  ].filter(Boolean).join("\n");
}

function getProfileImageArtDirection(profileId?: string) {
  if (profileId !== BRANDSDECODED_PROFILE_ID) return "";

  return [
    "Aesthetic: premium editorial authority, inspired by magazine-cover business and culture photography.",
    "Prefer concrete scenes with real human tension, strategy-room energy, news-desk atmosphere, or symbolic but specific business situations.",
    "Leave clean negative space for bold typography and avoid generic futuristic visuals unless the topic explicitly requires it.",
  ].join("\n");
}


// ─── Legacy adapter (Fase 1) ─────────────────────────────────────────────────
// Converte CarouselContentPayload (novo schema) → MappedSlide[] (formato legado).
// Permite que o pipeline de imagens, caption e export continuem inalterados.

function contentBlockToMappedSlide(
  block: NonNullable<CarouselContentPayload['blocks']>[number],
  index: number
): MappedSlide {
  const body = resolveBlockBody(block);

  const slideType: MappedSlide['slideType'] =
    block.type === 'hook' ? 'hook'
    : block.type === 'cta' ? 'cta'
    : 'development';

  const shortText = slideType === 'cta' ? body || block.title : undefined;

  return {
    title: block.title?.trim() || 'Slide ' + (index + 1),
    body,
    imageSearchQuery: block.imageSearchQuery?.trim() || '',
    slideType,
    shortText,
    imagePrompt: block.imagePrompt,
    backgroundPrompt: undefined,
    visualDirection: undefined,
    layoutNotes: undefined,
    highlightWords: block.highlightWords ?? [],
    editableFields: undefined,
  };
}

function assertAnthropicCarouselConfigured() {
  if (!ENV.anthropicApiKey.trim()) {
    throw new Error(
      "ANTHROPIC_API_KEY e obrigatoria para gerar ou regenerar carrosseis. A OpenAI continua sendo usada apenas para as imagens."
    );
  }
}

export type CarouselAgentInput = {
  topic: string;
  slideCount: number;
  carouselFormat?: "feed" | "story";
  style: string;
  profileId?: string;
  coverImageDataUrl?: string;
  coverImageUrl?: string;
  templateName?: string;
  templateStyleBrief?: string;
  templateImageDataUrl?: string;
  templateImageUrl?: string;
  useAiImages?: boolean;
  articleContext?: string;
  calibrationBlock?: string;
};

export type SlideEditableFields = {
  title: boolean;
  text: boolean;
  image: boolean;
  background: boolean;
  cta: boolean;
};

export type CarouselAgentSlide = {
  title: string;
  body: string;
  imageUrl?: string;
  slideType?: "hook" | "development" | "cta";
  shortText?: string;
  imagePrompt?: string;
  backgroundPrompt?: string;
  visualDirection?: string;
  layoutNotes?: string;
  highlightWords?: string[];
  editableFields?: SlideEditableFields;
};

export type CarouselAgentResult = {
  slides: CarouselAgentSlide[];
  coverImageUrl?: string;
  hook: string;
  caption: string;
  finalCta: string;
  hashtags?: string[];
  profileId?: string;
};

type CarouselAgentPayload = {
  carouselTitle?: string;
  caption?: string;
  imageSearchQuery?: string;
  hashtags?: string[];
  cta?: string;
  slides?: Array<{
    id?: number;
    type?: "hook" | "development" | "cta";
    title?: string;
    text?: string;
    shortText?: string;
    imagePrompt?: string;
    backgroundPrompt?: string;
    visualDirection?: string;
    layoutNotes?: string;
    imageSearchQuery?: string;
    highlightWords?: string[];
    editableFields?: SlideEditableFields;
  }>;
  generalDesignRules?: string[];
  qualityChecklist?: {
    textsFitTemplate?: boolean;
    strongHook?: boolean;
    clearProgression?: boolean;
    profileToneRespected?: boolean;
    formatRespected?: boolean;
    editableOutput?: boolean;
  };
};

type WikimediaImageInfo = {
  url?: string;
  thumburl?: string;
  mime?: string;
};

type WikimediaSearchResponse = {
  query?: {
    pages?: Record<string, { imageinfo?: WikimediaImageInfo[] }>;
  };
};

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeImageSearchQuery(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .slice(0, 120) || "professional editorial business photography"
  );
}

function buildCentralThemeImageQuery(input: {
  topic: string;
  slideTitle: string;
  imageSearchQuery: string;
}) {
  const specific = normalizeImageSearchQuery(input.imageSearchQuery);
  const topicNorm = normalizeImageSearchQuery(input.topic);
  // Combine topic with the slide-specific query for richer, more relevant results.
  // If the specific query already contains the topic, use it as-is.
  if (specific.length > 8) {
    const alreadyHasTopic = specific.toLowerCase().includes(topicNorm.toLowerCase().split(" ")[0]);
    return alreadyHasTopic ? specific : normalizeImageSearchQuery(`${topicNorm} ${specific}`).slice(0, 120);
  }
  return normalizeImageSearchQuery(`${topicNorm} ${input.slideTitle}`);
}

function pickRandom<T>(arr: T[], max = 3): T | undefined {
  if (!arr.length) return undefined;
  const pool = arr.slice(0, max);
  return pool[Math.floor(Math.random() * pool.length)];
}

async function searchGoogleCSE(query: string): Promise<string | undefined> {
  if (!ENV.googleCseKey || !ENV.googleCseCx) return undefined;
  try {
    const params = new URLSearchParams({
      key: ENV.googleCseKey,
      cx: ENV.googleCseCx,
      q: normalizeImageSearchQuery(query),
      searchType: "image",
      num: "10",
      imgType: "photo",
      imgSize: "xlarge",
      safe: "active",
      gl: "br",
      hl: "pt",
    });
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/customsearch/v1?${params}`,
      {},
      7000
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      items?: Array<{ link: string; image?: { height: number; width: number } }>;
    };
    const items = (data.items ?? []).filter((item) => {
      if (!item.link) return false;
      if (item.image?.width && item.image?.height && item.image.width > item.image.height * 1.5) return false;
      return true;
    });
    return pickRandom(items, 5)?.link;
  } catch {
    return undefined;
  }
}

async function searchUnsplashImage(query: string): Promise<string | undefined> {
  if (!ENV.unsplashAccessKey) return undefined;
  try {
    const params = new URLSearchParams({
      query: normalizeImageSearchQuery(query),
      per_page: "10",
      orientation: "portrait",
      order_by: "relevant",
      content_filter: "high",
    });
    const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${ENV.unsplashAccessKey}` },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as {
      results?: Array<{ urls?: { full?: string; regular?: string } }>;
    };
    const pick = pickRandom(data.results ?? [], 4);
    return pick?.urls?.full ?? pick?.urls?.regular;
  } catch {
    return undefined;
  }
}

async function searchPexelsImage(query: string): Promise<string | undefined> {
  if (!ENV.pexelsApiKey) return undefined;
  try {
    const params = new URLSearchParams({
      query: normalizeImageSearchQuery(query),
      per_page: "10",
      orientation: "portrait",
    });
    const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: ENV.pexelsApiKey },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as {
      photos?: Array<{ src?: { large2x?: string; large?: string } }>;
    };
    const pick = pickRandom(data.photos ?? [], 4);
    return pick?.src?.large2x ?? pick?.src?.large;
  } catch {
    return undefined;
  }
}

async function searchPixabayImage(query: string): Promise<string | undefined> {
  if (!ENV.pixabayApiKey) return undefined;
  try {
    const params = new URLSearchParams({
      key: ENV.pixabayApiKey,
      q: normalizeImageSearchQuery(query),
      image_type: "photo",
      orientation: "vertical",
      per_page: "10",
      safesearch: "true",
      editors_choice: "true",
      min_width: "1080",
    });
    const response = await fetch(`https://pixabay.com/api/?${params}`);
    if (!response.ok) return undefined;
    const data = (await response.json()) as { hits?: Array<{ largeImageURL?: string }> };
    // editors_choice may return 0 results — fall back without it
    if (!data.hits?.length) {
      const paramsNoEC = new URLSearchParams({
        key: ENV.pixabayApiKey,
        q: normalizeImageSearchQuery(query),
        image_type: "photo",
        orientation: "vertical",
        per_page: "10",
        safesearch: "true",
        min_width: "1080",
      });
      const res2 = await fetch(`https://pixabay.com/api/?${paramsNoEC}`);
      if (!res2.ok) return undefined;
      const data2 = (await res2.json()) as { hits?: Array<{ largeImageURL?: string }> };
      return pickRandom(data2.hits ?? [], 4)?.largeImageURL;
    }
    return pickRandom(data.hits, 4)?.largeImageURL;
  } catch {
    return undefined;
  }
}

async function searchWikimediaImage(query: string) {
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: normalizeImageSearchQuery(query),
      gsrnamespace: "6",
      gsrlimit: "8",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "1600",
      format: "json",
      origin: "*",
    });

    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: { "user-agent": "KrythosLab carousel image agent" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return undefined;

    const data = (await response.json()) as WikimediaSearchResponse;
    const pages = Object.values(data.query?.pages || {});
    const imageInfo = pages
      .flatMap((page) => page.imageinfo || [])
      .find((info) => {
        const imageUrl = info.thumburl || info.url;
        return Boolean(imageUrl && info.mime?.startsWith("image/") && !info.mime.includes("svg"));
      });

    return imageInfo?.thumburl || imageInfo?.url;
  } catch {
    return undefined;
  }
}

function buildCarouselImagePrompt(input: {
  topic: string;
  hook: string;
  slideTitle: string;
  slideBody: string;
  imageSearchQuery: string;
  slideIndex: number;
  templateName?: string;
  templateStyleBrief?: string;
  imagePrompt?: string;
  profileId?: string;
}) {
  const isHook = input.slideIndex === 0;
  const profileImageDirection = getProfileImageArtDirection(input.profileId);

  return [
    // ── Intent ──────────────────────────────────────────────────────────────
    "Create a photorealistic hero image for an Instagram/LinkedIn carousel slide.",
    `Portrait orientation, 2:3 aspect ratio. Topic: ${input.topic}.`,

    // ── Slide context ────────────────────────────────────────────────────────
    `Carousel hook: ${input.hook}`,
    `This slide: ${input.slideTitle}`,
    input.slideBody ? `Slide context: ${input.slideBody}` : undefined,
    `Visual direction: ${input.imageSearchQuery || input.hook}`,
    input.imagePrompt ? `Slide-specific art direction from the strategy model: ${input.imagePrompt}` : undefined,

    // ── Camera & lens ────────────────────────────────────────────────────────
    "Camera: full-frame mirrorless (Sony A7R V or Canon R5 equivalent). Lens: 24–50mm prime, f/1.4–f/2.8. Shallow depth of field with smooth bokeh background. Tack-sharp foreground subject.",

    // ── Lighting ─────────────────────────────────────────────────────────────
    "Lighting: dramatic professional lighting — cinematic side-light, rim-light, or motivated natural source. Deep shadows, rich midtones, controlled highlights. No flat or blown-out exposures.",

    // ── Color grade & mood ───────────────────────────────────────────────────
    "Color grade: cinematic. Deep blacks, slightly desaturated mids, selective color accents. Dark and moody overall — compatible with a dark UI overlay without losing subject legibility. Reference mood: high-end editorial magazines, Bloomberg or Wired cover photography.",

    // ── Composition ──────────────────────────────────────────────────────────
    isHook
      ? "Composition: impactful wide or medium shot. Strong visual tension. Hero subject occupies center-to-lower third, leaving the upper portion naturally dark for text overlay. Rule of thirds applied."
      : "Composition: clean medium or close-up shot. Hero subject clearly identifiable. Strong visual hierarchy. Upper area intentionally darker or uncluttered for text overlay. Rule of thirds applied.",

    // ── Template alignment ───────────────────────────────────────────────────
    input.templateName ? `Design context: ${input.templateName}` : undefined,
    input.templateStyleBrief
      ? `Visual style reference: ${input.templateStyleBrief}`
      : "Visual palette: dark navy/charcoal tones, compatible with a dark-themed carousel card design.",
    profileImageDirection,

    // ── Specificity requirement ──────────────────────────────────────────────
    "This image must be uniquely composed for this specific slide — not a generic stock cover. The scene, subject, and framing must directly represent the slide's message and energy.",

    // ── Reference image handling ─────────────────────────────────────────────
    "If a style reference image is provided: match its visual language, color palette, mood, depth, and finish — but generate a completely new scene aligned with this slide's content.",

    // ── Hard constraints ─────────────────────────────────────────────────────
    "Do not include: text, letters, numbers, logos, watermarks, UI elements, charts, infographics, device screens, fake typography, illustration, vector art, or cartoon style.",
    "Do not use stock-photo clichés: no random handshakes, disconnected office scenes, generic laptops, anonymous crowds, or objects unrelated to the topic.",
    "Photorealistic photography only. No AI-obvious artifacts. No oversaturated, overexposed, or HDR-style processing.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFallbackImageDataUrl(topic: string) {
  const hue = (Math.abs(topic.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 70) + 195;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 600" data-carousel-fallback="true">
  <defs>
    <linearGradient id="fallbackBg" x1="0" y1="0" x2="1080" y2="600" gradientUnits="userSpaceOnUse">
      <stop stop-color="hsl(${hue} 34% 86%)" />
      <stop offset="0.52" stop-color="hsl(${hue} 32% 62%)" />
      <stop offset="1" stop-color="hsl(${hue} 36% 28%)" />
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="34" /></filter>
  </defs>
  <rect width="1080" height="600" fill="url(#fallbackBg)" />
  <circle cx="250" cy="210" r="160" fill="white" opacity="0.22" filter="url(#blur)" />
  <circle cx="836" cy="258" r="230" fill="black" opacity="0.16" filter="url(#blur)" />
  <path d="M0 484L180 332L342 412L528 224L742 408L928 278L1080 386V600H0V484Z" fill="hsl(${hue} 42% 18%)" opacity="0.44" />
  <path d="M0 542L264 374L456 456L646 292L842 454L1080 316V600H0V542Z" fill="hsl(${hue} 42% 10%)" opacity="0.42" />
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function decodeDataUrlPayload(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return "";

  const header = dataUrl.slice(5, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);

  try {
    if (header.includes(";base64")) {
      return Buffer.from(body, "base64").toString("utf-8");
    }

    return decodeURIComponent(body);
  } catch {
    return "";
  }
}

function isCarouselFallbackImageUrl(imageUrl?: string) {
  if (!imageUrl || !imageUrl.startsWith("data:image/svg+xml")) {
    return false;
  }

  const payload = decodeDataUrlPayload(imageUrl);
  return payload.includes('data-carousel-fallback="true"') || payload.includes('id="fallbackBg"');
}

// Download an external image URL and re-upload to stable storage so it never expires.
// Returns the original URL unchanged if download or upload fails.
async function persistExternalImage(externalUrl: string): Promise<string> {
  try {
    const res = await fetch(externalUrl, {
      headers: { "User-Agent": "KrythosLab/1.0 carousel-agent", Accept: "image/*" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return externalUrl;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return externalUrl;
    const ext = ct.includes("webp") ? "webp" : ct.includes("jpeg") || ct.includes("jpg") ? "jpg" : "png";
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = `carousel-stock-${randomUUID()}.${ext}`;
    const stored = await storagePut(`generated/${filename}`, buffer, ct.split(";")[0].trim());
    return stored.url;
  } catch {
    return externalUrl;
  }
}

async function resolveCarouselCoverImage(input: {
  topic: string;
  hook: string;
  imageSearchQuery: string;
  slideTitle: string;
  slideBody: string;
  slideIndex: number;
  templateName?: string;
  templateStyleBrief?: string;
  imagePrompt?: string;
  profileId?: string;
}) {
  const query = buildCentralThemeImageQuery(input);

  // 1. Serper — Google Images via Serper API (requires SERPER_API_KEY)
  const serperResult = await searchSerperImages(query);
  if (serperResult) return persistExternalImage(serperResult);

  // 2. Google Custom Search JSON API — official Google Images, free 100/day
  //    (requires GOOGLE_CSE_KEY + GOOGLE_CSE_CX in environment)
  const cseResult = await searchGoogleCSE(query);
  if (cseResult) return persistExternalImage(cseResult);

  // 3. Stock photo libraries (require their own API keys)
  const stockFallbacks = [
    () => searchUnsplashImage(query),
    () => searchPexelsImage(query),
    () => searchPixabayImage(query),
    () => searchWikimediaImage(query),
  ];
  for (const fn of stockFallbacks) {
    try {
      const url = await fn();
      if (url) return persistExternalImage(url);
    } catch {
      // continue to next source
    }
  }

  // 4. AI-generated image as last resort — OpenAI is always configured,
  //    so slides never end up with just a gradient placeholder
  try {
    const generated = await generateImage({
      prompt: buildCarouselImagePrompt({
        topic: input.topic,
        hook: input.hook,
        slideTitle: input.slideTitle,
        slideBody: input.slideBody,
        imageSearchQuery: query,
        slideIndex: input.slideIndex,
        templateName: input.templateName,
        templateStyleBrief: input.templateStyleBrief,
        imagePrompt: input.imagePrompt,
        profileId: input.profileId,
      }),
    });
    if (generated.url) return generated.url;
  } catch {
    // If OpenAI is not configured or fails, fall back to gradient
  }

  return buildFallbackImageDataUrl(`${input.topic} ${input.slideTitle}`);
}

async function resolveCarouselCoverImageWithAI(input: {
  topic: string;
  hook: string;
  imageSearchQuery: string;
  slideTitle: string;
  slideBody: string;
  slideIndex: number;
  templateName?: string;
  templateStyleBrief?: string;
  referenceImageUrl?: string;
  imagePrompt?: string;
  profileId?: string;
}) {
  const query = buildCentralThemeImageQuery(input);
  try {
    const generatedImage = await generateImage({
      prompt: buildCarouselImagePrompt({
        topic: input.topic,
        hook: input.hook,
        slideTitle: input.slideTitle,
        slideBody: input.slideBody,
        imageSearchQuery: query,
        slideIndex: input.slideIndex,
        templateName: input.templateName,
        templateStyleBrief: input.templateStyleBrief,
        imagePrompt: input.imagePrompt,
        profileId: input.profileId,
      }),
      referenceImageUrl: input.referenceImageUrl,
    });
    if (generatedImage.url) return generatedImage.url;
  } catch (err) {
    console.warn("[CarouselAgent] AI image generation failed, falling back to stock photos:", err);
  }
  return resolveCarouselCoverImage(input);
}

type MappedSlide = {
  title: string;
  body: string;
  imageSearchQuery: string;
  slideType: "hook" | "development" | "cta" | undefined;
  shortText?: string;
  imagePrompt?: string;
  backgroundPrompt?: string;
  visualDirection?: string;
  layoutNotes?: string;
  highlightWords: string[];
  editableFields?: SlideEditableFields;
};

/**
 * Ajusta o array de slides (in-place) para corresponder ao target.
 * Tolerante a diferenças pequenas do LLM — evita lançar erro desnecessário.
 */
export function adjustSlideCount(slides: MappedSlide[], target: number): void {
  if (slides.length === target) return;

  if (slides.length > target) {
    // Remove slides do meio (desenvolvimento), preservando hook (0) e CTA (last)
    const excess = slides.length - target;
    const removeFrom = Math.max(1, slides.length - 1 - excess);
    slides.splice(removeFrom, excess);
    return;
  }

  const missing = target - slides.length;
  if (missing > 3) {
    throw new Error(
      `O agente retornou apenas ${slides.length} slides dos ${target} solicitados. Tente novamente.`
    );
  }

  // Preenche com cópia do slide de desenvolvimento mais central
  const devSlide =
    slides.find((s) => s.slideType === "development") ??
    slides[Math.floor(slides.length / 2)];

  for (let i = 0; i < missing; i++) {
    const ctaIndex = slides.findIndex((s) => s.slideType === "cta");
    const insertAt = ctaIndex > 0 ? ctaIndex : slides.length - 1;
    slides.splice(insertAt, 0, {
      ...devSlide,
      title: `${devSlide?.title ?? ""} (cont.)`,
    });
  }
}

export async function generateCarouselWithAgent(
  input: CarouselAgentInput
): Promise<CarouselAgentResult> {
  assertAnthropicCarouselConfigured();

  // Phase 2: enforce 5-10 slide range for optimal Instagram 2026 performance
  if (input.slideCount < 5 || input.slideCount > 10) {
    const clamped = Math.max(5, Math.min(10, input.slideCount));
    console.warn(`[CarouselAgent] slideCount=${input.slideCount} fora do range otimizado (5-10). Ajustando para ${clamped}.`);
    input = { ...input, slideCount: clamped };
  }

  const referenceImageUrl = input.coverImageDataUrl || input.coverImageUrl;
  const templateImageUrl = input.templateImageDataUrl || input.templateImageUrl;
  const styleGuide = input.templateStyleBrief?.trim()
    ? `Template escolhido: ${input.templateName || input.style}. ${input.templateStyleBrief.trim()}`
    : input.profileId === BRANDSDECODED_PROFILE_ID
      ? "Visual editorial premium, dark, minimal and high-contrast. Background preto ou quase preto, tipografia branca bold, respiro generoso e acento quente discreto."
    : STYLE_GUIDE[input.style] || `Estilo visual: ${input.style}.`;

  // Use article content when provided; otherwise fall back to Google search
  const topicResearch = input.articleContext
    ? `[Notícia]\n${input.articleContext}`
    : await researchTopicContext(input.topic).catch(() => null);

  if (topicResearch) {
    console.log(`[CarouselAgent] Research context ready for topic: "${input.topic}" (source: ${input.articleContext ? "article" : "google"})`);
  }

  const lastSlideIndex = input.slideCount;

  const carouselFormat = input.carouselFormat || "feed";
  const formatInfo = carouselFormat === "story"
    ? "Story (9:16, 1080x1920) — formato vertical extendido do Instagram Stories"
    : "Feed (4:5, 1080x1350) — formato padrão de posts no feed";

  const profileContext = input.profileId
    ? PROFILE_CONTEXTS[input.profileId] ?? ""
    : "";
  const profileBlueprint = getProfileGenerationBlueprint({
    profileId: input.profileId,
    articleBased: Boolean(input.articleContext),
    slideCount: input.slideCount,
  });
  const captionBlueprint = getProfileCaptionBlueprint(input.profileId);

  const userPrompt = [
    profileContext ? `=== Perfil do Instagram ===\n${profileContext}\n` : undefined,
    profileBlueprint ? `=== Framework estrategico ===\n${profileBlueprint}\n` : undefined,
    `Tema do carrossel: ${input.topic}`,
    `Quantidade exata de slides: ${input.slideCount}`,
    `Formato: ${formatInfo}`,
    `Direcao visual: ${styleGuide}`,
    input.templateName ? `Nome do template visual: ${input.templateName}` : undefined,
    `MAPA DE SLIDES (siga obrigatoriamente):`,
    `  Slide 1 (id:1, type:"hook"): PERGUNTA-GANCHO OBRIGATÓRIO — formato de pergunta direta (ex: "Qual desses 5 erros você comete?", "Por que sua ${input.topic.slice(0, 30)} ainda não mudou?"). Máximo 12 palavras. Cria lacuna de informação. NUNCA entregue o conteúdo no slide 1.`,
    input.slideCount > 2
      ? `  Slides 2 a ${input.slideCount >= 5 ? lastSlideIndex - 2 : lastSlideIndex - 1} (type:"development"): cada um aprofunda um aspecto diferente do tema com dado concreto, fato, contraste ou descoberta específica. PROIBIDO: slides genéricos sem informação real ("é importante...", "precisa de atenção...", etc).`
      : undefined,
    input.slideCount >= 5
      ? `  Slide ${lastSlideIndex - 1} (id:${lastSlideIndex - 1}, type:"development"): RESUMO SALVÁVEL — checklist numerado, framework em tópicos ou síntese visual de alto contraste. Projetado para ser screenshot e salvo isoladamente. Este é o slide que gera salvamentos.`
      : undefined,
    `  Slide ${lastSlideIndex} (id:${lastSlideIndex}, type:"cta"): CTA DE SALVAMENTO — peça EXPLICITAMENTE que o usuário salve o post com motivo concreto e específico ("Salva esse carrossel pra consultar quando precisar de X"). NUNCA peça curtida.`,
    "Gere imageSearchQuery geral em ingles (3-8 palavras) para fotografia editorial do tema central.",
    "Para cada slide, gere imageSearchQuery em ingles especifico (4-10 palavras) e imagePrompt detalhado em ingles.",
    "Nao use consultas abstratas como transformation, growth, future ou innovation sem objeto concreto do tema.",
    captionBlueprint ? `Legenda: ${captionBlueprint}` : undefined,
    topicResearch
      ? `\n=== Pesquisa sobre o tema ===\nUse os fatos, dados e conceitos abaixo para enriquecer os slides de desenvolvimento. Incorpore-os naturalmente — nao cite a fonte:\n\n${topicResearch}`
      : undefined,
    input.calibrationBlock ? `\n${input.calibrationBlock}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  // ── Build Anthropic content (supports images) ───────────────────────────────
  const anthropicParts: AnthropicContent[] = [{ type: "text", text: userPrompt }];
  if (templateImageUrl) {
    anthropicParts.push({ type: "text", text: "Template visual de referencia — preserve a familia visual." });
    const img = buildAnthropicImageContent(templateImageUrl);
    if (img) anthropicParts.push(img);
  }
  if (referenceImageUrl) {
    anthropicParts.push({ type: "text", text: "Imagem de referencia de conteudo — use quando fizer sentido." });
    const img = buildAnthropicImageContent(referenceImageUrl);
    if (img) anthropicParts.push(img);
  }

  // ── Build OpenAI content (fallback) ────────────────────────────────────────

  // Tokens proporcionais ao número de slides — cada slide tem ~8 campos ricos
  // 5 slides ≈ 3500 tok, 8 slides ≈ 5500 tok, 10 slides ≈ 7000 tok
  const maxTokens = input.slideCount <= 5 ? 4096
    : input.slideCount <= 7 ? 6144
    : 8192;

  // ── Invoke LLM com Content Agent (Fase 1) — retorna blocos semânticos ────────
  let contentPayload: CarouselContentPayload = { blocks: [] };
  let raw = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    raw = await invokeAnthropicLLM({
      system: CONTENT_AGENT_SYSTEM_PROMPT,
      userContent: anthropicParts.length === 1 ? userPrompt : anthropicParts,
      maxTokens: attempt === 1 ? maxTokens : 8192,
    });
    contentPayload = parseClaudeJsonResponse<CarouselContentPayload>(raw, { blocks: [] });
    if ((contentPayload.blocks?.length ?? 0) > 0) break;
    console.warn('[CarouselAgent] Tentativa ' + attempt + ': blocks vazios. Raw length=' + raw.length + '. Retentando com maxTokens=8192...');
  }

  // Adapter legado: converte content blocks → MappedSlide[]
  const slides: MappedSlide[] = (contentPayload.blocks || []).map((block, index) =>
    contentBlockToMappedSlide(block, index)
  );

  if (slides.length === 0) {
    console.error(`[CarouselAgent] Falha após 2 tentativas. Raw (primeiros 500 chars): ${raw.slice(0, 500)}`);
    throw new Error(
      "O agente nao conseguiu gerar os slides. Verifique se ANTHROPIC_API_KEY esta configurada e tente novamente."
    );
  }

  adjustSlideCount(slides, input.slideCount);

  const hook = cleanText(
    contentPayload.blocks?.find((b) => b.type === "hook")?.title,
    slides[0]?.title || input.topic
  );
  const finalCta = cleanText(
    contentPayload.cta ?? contentPayload.blocks?.find((b) => b.type === "cta")?.title,
    FALLBACK_CTA
  );
  const caption = cleanText(
    contentPayload.caption,
    `${hook}\n\n${slides.map((slide) => `${slide.title}: ${slide.body}`).join("\n\n")}\n\n${finalCta}`
  );
  const slidesWithImage: CarouselAgentSlide[] = await Promise.all(
    slides.map(async (slide, index) => {
      const slideImageUrl =
        referenceImageUrl ||
        (await resolveCarouselCoverImage({
          topic: input.topic,
          hook,
          imageSearchQuery: (() => {
            const globalQ = cleanText(contentPayload.imageSearchQuery, "") || normalizeImageSearchQuery(input.topic);
            const slideQ = cleanText(slide.imageSearchQuery, "");
            // Always anchor to global theme so per-slide queries don't drift to unrelated subjects
            if (slideQ) return `${globalQ} ${slideQ}`;
            return `${globalQ} ${slide.title}`;
          })(),
          slideTitle: slide.title,
          slideBody: slide.body,
          slideIndex: index,
          templateName: input.templateName,
          templateStyleBrief: input.templateStyleBrief,
          imagePrompt: slide.imagePrompt,
          profileId: input.profileId,
        }));

      return {
        title: slide.title,
        body: slide.body,
        imageUrl: slideImageUrl,
        slideType: slide.slideType,
        shortText: slide.shortText,
        imagePrompt: slide.imagePrompt,
        backgroundPrompt: slide.backgroundPrompt,
        visualDirection: slide.visualDirection,
        layoutNotes: slide.layoutNotes,
        highlightWords: slide.highlightWords,
        editableFields: slide.editableFields,
      };
    })
  );

  const sharedImageUrl =
    [referenceImageUrl, ...slidesWithImage.map((slide) => slide.imageUrl)].find(
      (imageUrl) => imageUrl && !isCarouselFallbackImageUrl(imageUrl)
    ) || undefined;

  const normalizedSlides = slidesWithImage.map((slide) => ({
    ...slide,
    imageUrl:
      slide.imageUrl && !isCarouselFallbackImageUrl(slide.imageUrl)
        ? slide.imageUrl
        : sharedImageUrl || slide.imageUrl,
  }));

  return {
    slides: normalizedSlides,
    coverImageUrl: normalizedSlides[0]?.imageUrl || sharedImageUrl || referenceImageUrl,
    hook,
    caption,
    finalCta,
    hashtags: contentPayload.hashtags ?? [],
    profileId: input.profileId,
  };
}

// ─── Regeneration helpers ──────────────────────────────────────────────────────

const REGEN_SYSTEM = `Você é um social media sênior e copywriter especializado em carrosséis de Instagram. Retorne APENAS JSON válido, sem texto antes ou depois.`;

async function callRegenLLM(userPrompt: string, fallback: CarouselAgentPayload): Promise<CarouselAgentPayload> {
  assertAnthropicCarouselConfigured();
  const raw = await invokeAnthropicLLM({ system: REGEN_SYSTEM, userContent: userPrompt });
  return parseClaudeJsonResponse<CarouselAgentPayload>(raw, fallback);
}

export async function regenerateSlide(params: {
  topic: string;
  hook: string;
  totalSlides: number;
  slideIndex: number;
  slideType: "hook" | "development" | "cta";
  profileId?: string;
  format?: "feed" | "story";
  style?: string;
  useAiImages?: boolean;
}): Promise<CarouselAgentSlide> {
  const profileCtx = params.profileId ? (PROFILE_CONTEXTS[params.profileId] ?? "") : "";
  const profileBlueprint = getProfileRegenBlueprint({
    profileId: params.profileId,
    slideType: params.slideType,
  });
  const prompt = [
    profileCtx ? `Perfil: ${profileCtx}` : undefined,
    profileBlueprint ? `Framework: ${profileBlueprint}` : undefined,
    `Tema: ${params.topic}`,
    `Formato: ${params.format ?? "feed"}. Estilo: ${params.style ?? "signature"}.`,
    `Carrossel tem ${params.totalSlides} slides. Você deve regenerar o slide ${params.slideIndex + 1} (tipo: ${params.slideType}).`,
    `Retorne JSON com um único objeto no formato:`,
    `{"id":${params.slideIndex + 1},"type":"${params.slideType}","title":"...","text":"...","shortText":"...","imagePrompt":"...","backgroundPrompt":"...","visualDirection":"...","layoutNotes":"...","imageSearchQuery":"...","highlightWords":[],"editableFields":{"title":true,"text":true,"image":true,"background":true,"cta":false}}`,
  ].filter(Boolean).join("\n");

  const result = await callRegenLLM(prompt, {});
  const s = (result as unknown as Record<string, unknown>);

  const slideData: CarouselAgentSlide = {
    title: cleanText(s.title, `Slide ${params.slideIndex + 1}`),
    body: cleanText(s.text),
    slideType: params.slideType,
    shortText: typeof s.shortText === "string" ? s.shortText : undefined,
    imagePrompt: typeof s.imagePrompt === "string" ? s.imagePrompt : undefined,
    backgroundPrompt: typeof s.backgroundPrompt === "string" ? s.backgroundPrompt : undefined,
    visualDirection: typeof s.visualDirection === "string" ? s.visualDirection : undefined,
    layoutNotes: typeof s.layoutNotes === "string" ? s.layoutNotes : undefined,
    highlightWords: Array.isArray(s.highlightWords) ? (s.highlightWords as string[]) : [],
    editableFields: typeof s.editableFields === "object" && s.editableFields !== null
      ? (s.editableFields as SlideEditableFields)
      : { title: true, text: true, image: true, background: true, cta: false },
  };

  const imageSearchQuery = cleanText(s.imageSearchQuery, `${params.topic} ${slideData.title}`);
  const resolveImage = params.useAiImages ? resolveCarouselCoverImageWithAI : resolveCarouselCoverImage;
  slideData.imageUrl = await resolveImage({
    topic: params.topic,
    hook: params.hook,
    imageSearchQuery,
    slideTitle: slideData.title,
    slideBody: slideData.body,
    slideIndex: params.slideIndex,
    imagePrompt: slideData.imagePrompt,
    profileId: params.profileId,
  });

  return slideData;
}

export async function regenerateSlideText(params: {
  topic: string;
  hook: string;
  slideType: "hook" | "development" | "cta";
  currentTitle: string;
  currentBody: string;
  profileId?: string;
  instruction?: string;
}): Promise<{ title: string; body: string; shortText: string; highlightWords: string[] }> {
  const profileCtx = params.profileId ? (PROFILE_CONTEXTS[params.profileId] ?? "") : "";
  const profileBlueprint = getProfileRegenBlueprint({
    profileId: params.profileId,
    slideType: params.slideType,
  });
  const prompt = [
    profileCtx ? `Perfil: ${profileCtx}` : undefined,
    profileBlueprint ? `Framework: ${profileBlueprint}` : undefined,
    `Tema geral: ${params.topic}. Gancho do carrossel: ${params.hook}.`,
    `Slide atual (tipo: ${params.slideType}): Título: "${params.currentTitle}" | Texto: "${params.currentBody}"`,
    params.instruction ? `Instrução do usuário: ${params.instruction}` : "Melhore o texto para ser mais impactante e natural.",
    `Retorne JSON: {"title":"...","text":"...","shortText":"...","highlightWords":[]}`,
  ].filter(Boolean).join("\n");

  const result = await callRegenLLM(prompt, {});
  const s = result as unknown as Record<string, unknown>;
  return {
    title: cleanText(s.title, params.currentTitle),
    body: cleanText(s.text, params.currentBody),
    shortText: typeof s.shortText === "string" ? s.shortText : "",
    highlightWords: Array.isArray(s.highlightWords) ? (s.highlightWords as string[]) : [],
  };
}

export async function regenerateSlideImage(params: {
  topic: string;
  hook: string;
  slideTitle: string;
  slideBody: string;
  slideIndex: number;
  imagePrompt?: string;
  profileId?: string;
  useAiImages?: boolean;
}): Promise<{ imageUrl: string; imagePrompt: string }> {
  const profileCtx = params.profileId ? (PROFILE_CONTEXTS[params.profileId] ?? "") : "";
  const profileBlueprint = getProfileRegenBlueprint({
    profileId: params.profileId,
    slideType: "development",
  });
  let imagePrompt = params.imagePrompt ?? "";

  if (!imagePrompt) {
    const prompt = [
      profileCtx ? `Perfil visual: ${profileCtx}` : undefined,
      profileBlueprint ? `Framework: ${profileBlueprint}` : undefined,
      `Tema: ${params.topic}. Slide: "${params.slideTitle}" — ${params.slideBody}`,
      `Gere um imagePrompt em inglês detalhado (lighting, composition, mood) para uma foto profissional deste slide.`,
      `Retorne JSON: {"imagePrompt":"...","imageSearchQuery":"..."}`,
    ].filter(Boolean).join("\n");

    const result = await callRegenLLM(prompt, {});
    const s = result as unknown as Record<string, unknown>;
    imagePrompt = cleanText(s.imagePrompt, `${params.topic} ${params.slideTitle}`);
  }

  const resolveImage = params.useAiImages ? resolveCarouselCoverImageWithAI : resolveCarouselCoverImage;
  const imageUrl = await resolveImage({
    topic: params.topic,
    hook: params.hook,
    imageSearchQuery: `${params.topic} ${params.slideTitle}`,
    slideTitle: params.slideTitle,
    slideBody: params.slideBody,
    slideIndex: params.slideIndex,
    imagePrompt,
    profileId: params.profileId,
  });

  return { imageUrl, imagePrompt };
}

export async function regenerateCaption(params: {
  topic: string;
  hook: string;
  slides: Array<{ title: string; body: string }>;
  profileId?: string;
  cta: string;
}): Promise<{ caption: string; hashtags: string[]; cta: string }> {
  const profileCtx = params.profileId ? (PROFILE_CONTEXTS[params.profileId] ?? "") : "";
  const captionBlueprint = getProfileCaptionBlueprint(params.profileId);
  const slidesSummary = params.slides
    .map((s, i) => `Slide ${i + 1}: ${s.title} — ${s.body}`)
    .join("\n");

  const prompt = [
    profileCtx ? `Perfil: ${profileCtx}` : undefined,
    captionBlueprint ? `Framework da legenda: ${captionBlueprint}` : undefined,
    `Tema: ${params.topic}. Gancho: ${params.hook}.`,
    `Slides:\n${slidesSummary}`,
    `CTA atual: ${params.cta}`,
    `Gere uma legenda completa para o Instagram e hashtags relevantes.`,
    `Retorne JSON: {"caption":"...","hashtags":["hashtag1","hashtag2"],"cta":"..."}`,
  ].filter(Boolean).join("\n");

  const result = await callRegenLLM(prompt, {});
  const s = result as unknown as Record<string, unknown>;
  return {
    caption: cleanText(s.caption, `${params.hook}\n\n${params.cta}`),
    hashtags: Array.isArray(s.hashtags) ? (s.hashtags as string[]) : [],
    cta: cleanText(s.cta, params.cta),
  };
}

export function validateCarouselOutput(result: CarouselAgentResult, expectedSlideCount: number): boolean {
  if (result.slides.length !== expectedSlideCount) return false;
  if (!result.hook || !result.caption) return false;
  return result.slides.every((s) => s.title && s.body !== undefined);
}
