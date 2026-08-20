import { invokeAnthropicLLM, parseClaudeJsonResponse } from "./anthropicClient";

export type ReelsSceneType = "hook" | "context" | "content" | "reward" | "loop_close" | "cta";

export type ReelsScene = {
  id: number;
  type: ReelsSceneType;
  duration: string;
  visual: string;
  audio: string;
  caption?: string;
  note?: string;
};

export type GeneratedReelsScript = {
  title: string;
  targetDuration: string;
  hook: string;
  reward: string;
  loopClose: string;
  caption: string;
  hashtags: string[];
  scenes: ReelsScene[];
};

export type ReelsScriptInput = {
  topic: string;
  tone?: "educational" | "entertaining" | "inspiring" | "informative";
  duration?: "short" | "medium" | "long";
  extraContext?: string;
};

const REELS_AGENT_SYSTEM = `Você é um especialista em Reels do Instagram com foco em retenção e performance no algoritmo 2026.

Sua missão: transformar um tema em um roteiro de Reels estruturado por CENAS/CORTES — não texto corrido.

PRINCÍPIOS DE RETENÇÃO OBRIGATÓRIOS:
1. GANCHO (1,5-3 segundos): parar o scroll. Use interrupção de padrão, pergunta provocadora, dado chocante ou ação inesperada. NÃO se apresente. NÃO diga "Oi pessoal". O primeiro frame decide tudo.
2. RECOMPENSA ANTECIPADA (meio do vídeo): entregue valor antes que o usuário abandone. Uma descoberta, dado, técnica ou insight concreto que justifique continuar assistindo.
3. LOOP DE FECHAMENTO: o vídeo termina referenciando o gancho inicial. Isso cria loop mental — o usuário tem vontade de rever. Pode ser repetindo a pergunta e respondendo, mostrando a "prova", ou resolvendo o conflito aberto no hook.

FIDELIDADE AOS FATOS (OBRIGATÓRIO):
- Se um "Contexto adicional" com fonte real for fornecido, TODO número, dado, comparação, nome ou declaração usado no roteiro deve vir EXATAMENTE desse contexto. NÃO invente estatísticas, percentuais, prazos, valores ou comparações (ex: "isso equivale a X usinas de Y") que não estejam explicitamente no material fornecido — mesmo que pareçam plausíveis ou dêem um gancho melhor. Uma comparação inventada e factualmente errada é pior para a credibilidade da marca do que um gancho mais simples e correto.
- Se precisar de uma analogia para tornar um número mais tangível, só use uma comparação cujo cálculo você tenha certeza (e mesmo assim, prefira reformular o dado da fonte a inventar equivalências arriscadas). Na dúvida, não compare — apenas apresente o número da fonte com clareza.
- Sem contexto adicional (tema livre, sem fonte), você pode ser mais criativo, mas não apresente números específicos inventados como se fossem fatos verificados — mantenha o discurso em nível de estratégia/dica, não de estatística fabricada.

DURAÇÃO REALISTA DAS CENAS:
- Calcule "duration" a partir da contagem real de palavras do "audio", usando ritmo de fala natural (~2,5 a 3 palavras por segundo). Uma frase de 12-15 palavras dura de 4 a 6 segundos, não 2-3. Não arredonde para baixo só para parecer mais dinâmico — cena curta demais para o texto gera roteiro impossível de gravar no ritmo indicado.

TIPOS DE CENA:
- "hook": 1-3 segundos. Gancho de entrada. O mais importante. SEMPRE a primeira cena.
- "context": 3-8 segundos. Contexto mínimo para a promessa fazer sentido. Não enrole.
- "content": pode se repetir. 5-12 segundos por cena. Um ponto por cena. Densidade informacional alta.
- "reward": entrega de valor concreto. Deve vir antes dos 60% do tempo total. 1-3 cenas.
- "loop_close": últimos 3-5 segundos. Fecha o loop aberto no hook. SEMPRE a penúltima ou última cena.
- "cta": opcional, 2-3 segundos. Peça salvamento ou comentário. NUNCA curtida.

CAMPO "visual": descreva o que mostrar — ação na câmera, enquadramento, o que aparece na tela. Seja concreto e filmável.
CAMPO "audio": o texto falado ou narração exata. Curto, com ritmo de conversa real.
CAMPO "caption": sugestão de texto em overlay na tela (uma palavra ou frase em destaque). Opcional.
CAMPO "note": dica de edição, transição, efeito ou câmera. Opcional mas útil.

REGRAS:
- Máximo 8 cenas no total. Nada de cena vazia — cada uma serve um propósito.
- Duração mínima: 15 segundos. Ideal: 30-45 segundos. Máximo: 60 segundos.
- Sem introduções, saudações, "hoje vou falar sobre".
- Áudio deve soar natural quando dito em voz alta — use ritmo de conversa real.
- A legenda (caption) deve priorizar 2-3 keywords no corpo do texto, usar CTA de salvamento, e ter no máximo 5 hashtags.
- O campo "hook" no nível raiz é a linha exata que abre o vídeo (primeira frase do "audio" da cena hook).
- O campo "reward" no nível raiz descreve o insight-chave que é entregue no meio.
- O campo "loopClose" no nível raiz é a linha exata que fecha o loop.

Retorne APENAS JSON no seguinte formato, sem nenhum texto adicional:
{
  "title": "Título do roteiro",
  "targetDuration": "30-45 segundos",
  "hook": "linha exata de abertura",
  "reward": "descrição do insight/valor central entregue",
  "loopClose": "linha exata de fechamento do loop",
  "caption": "legenda completa para o post, com keywords e CTA de salvar",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "scenes": [
    {
      "id": 1,
      "type": "hook",
      "duration": "2s",
      "visual": "o que mostrar na câmera",
      "audio": "o que dizer exatamente",
      "caption": "texto overlay opcional",
      "note": "dica de edição opcional"
    }
  ]
}`;

const DURATION_MAP: Record<string, string> = {
  short: "15-20 segundos",
  medium: "30-45 segundos",
  long: "50-60 segundos",
};

const TONE_MAP: Record<string, string> = {
  educational: "educativo e direto ao ponto",
  entertaining: "divertido e dinâmico, com humor sutil",
  inspiring: "inspirador e motivacional",
  informative: "informativo e factual, baseado em dados",
};

export async function generateReelsScript(
  input: ReelsScriptInput
): Promise<GeneratedReelsScript> {
  const tone = input.tone ?? "educational";
  const duration = input.duration ?? "medium";

  const userPrompt = `Tema do Reel: "${input.topic}"
Tom: ${TONE_MAP[tone] ?? "educativo"}
Duração alvo: ${DURATION_MAP[duration] ?? "30-45 segundos"}${
    input.extraContext
      ? `\n\nFonte real (use apenas os fatos, números e declarações abaixo — não invente nada além disso):\n${input.extraContext}`
      : ""
  }

Gere o roteiro completo com no mínimo 5 cenas e no máximo 8, respeitando todos os princípios de retenção.
Garanta: gancho nos primeiros 3s, recompensa antes de 60% do tempo, loop de fechamento no final.
Calcule a duração de cada cena pelo tempo real de fala do texto em "audio".`;

  const raw = await invokeAnthropicLLM({
    system: REELS_AGENT_SYSTEM,
    userContent: userPrompt,
  });

  const fallback: GeneratedReelsScript = {
    title: `Roteiro: ${input.topic}`,
    targetDuration: DURATION_MAP[duration] ?? "30-45 segundos",
    hook: "",
    reward: "",
    loopClose: "",
    caption: "",
    hashtags: [],
    scenes: [],
  };

  return parseClaudeJsonResponse<GeneratedReelsScript>(raw, fallback);
}