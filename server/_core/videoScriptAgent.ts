import { invokeLLM } from "./llm";

export type VideoScriptTone = "professional" | "casual" | "inspiring" | "educational";

export type GenerateVideoScriptInput = {
  topic: string;
  tone?: VideoScriptTone;
};

export type GeneratedVideoScript = {
  title: string;
  script: string;
};

const TONE_GUIDE: Record<VideoScriptTone, string> = {
  professional: "profissional, humano, claro e confiavel",
  casual: "natural, proximo, espontaneo e facil de ouvir",
  inspiring: "inspirador, caloroso, humano e energizante",
  educational: "didatico, simples, humano e objetivo",
};

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function generateVideoScriptWithAgent(
  input: GenerateVideoScriptInput
): Promise<GeneratedVideoScript> {
  const tone = input.tone ?? "professional";
  const llmResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Voce escreve roteiros curtos para videos com avatar falante em portugues do Brasil.

Escreva como uma pessoa real falando para a camera, e nao como artigo, locucao publicitaria ou texto corporativo.

Regras obrigatorias:
- entregue um titulo curto e um roteiro pronto para leitura
- escreva em portugues brasileiro falado, com ritmo natural de conversa
- use entre 4 e 6 frases
- prefira entre 55 e 110 palavras
- varie o tamanho das frases para soar humano
- use linguagem simples, concreta e facil de ouvir
- pode usar pausas naturais com virgulas e pontos, mas sem exagero
- soe confiante e natural, nunca teatral
- evite frases genericas de IA, como "nos dias de hoje", "se voce quer transformar sua vida", "vamos explorar", "neste video", "olá pessoal" e similares
- evite tom de propaganda, clichês, exageros, listas, hashtags, emojis, marcacoes de cena e texto entre parenteses
- nao use travessoes de roteiro, numeracao ou bullets
- nao escreva como release, aula formal ou post de blog
- sempre faca o texto parecer falado por uma pessoa inteligente, espontanea e crivel

Estrutura desejada:
- comece com uma abertura natural que puxe a atencao sem soar clickbait
- desenvolva a ideia principal de forma fluida
- feche com uma conclusao curta ou convite sutil, sem CTA agressivo`,
      },
      {
        role: "user",
        content: `Tema: ${input.topic}
Tom: ${TONE_GUIDE[tone]}
Objetivo: gerar um roteiro falado, o mais realista e natural possivel, pronto para um avatar em video.

Importante:
- faca parecer que a pessoa realmente improvisou bem esse texto
- use transicoes naturais entre as frases
- se fizer sentido, inclua um detalhe concreto ou exemplo simples
- mantenha o texto limpo e fluido, sem cara de texto escrito para blog`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "video_script",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            script: { type: "string" },
          },
          required: ["title", "script"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = llmResponse.choices[0]?.message?.content;
  const parsed = JSON.parse((typeof raw === "string" ? raw : JSON.stringify(raw)) || "{}");
  const title = compactText(String(parsed.title || input.topic)).slice(0, 512);
  const script = compactText(String(parsed.script || ""));

  if (!script) {
    throw new Error("O agente nao retornou um roteiro valido.");
  }

  return { title, script };
}
