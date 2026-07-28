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

Imagine que uma pessoa inteligente e confiante esta gravando um video rapido para redes sociais — sem teleprompter, sem ensaio, mas com clareza. Voce captura exatamente esse tom.

Regras obrigatorias:
- entregue um titulo curto e um roteiro pronto para fala
- escreva em portugues brasileiro falado, com ritmo real de conversa
- use entre 5 e 7 frases
- prefira entre 60 e 120 palavras
- alterne frases curtas (4-6 palavras) com frases medias (10-15 palavras) para criar ritmo humano
- use linguagem simples, concreta e facil de ouvir — como se explicasse para um amigo
- inclua pausas naturais com virgulas e reticencias onde a pessoa respiraria ou pensaria
- pode comecar uma frase com "E..." ou "Mas..." ou "Olha..." — isso soa humano
- soe confiante e espontaneo, nunca teatral nem ensaiado
- evite frases genericas de IA: "nos dias de hoje", "se voce quer transformar sua vida", "vamos explorar", "neste video", "ola pessoal", "incrivel", "revolucionario"
- evite tom de propaganda, cliches, exageros, listas, hashtags, emojis, marcacoes de cena e texto entre parenteses
- nao use travessoes de roteiro, numeracao ou bullets
- nao escreva como release, aula formal ou post de blog

Estrutura desejada:
- abra de forma inesperada ou com uma observacao concreta — sem introducao obvia
- desenvolva a ideia principal com pelo menos um detalhe ou exemplo real
- feche de forma natural: uma reflexao curta, uma pergunta simples ou um convite sem pressao`,
      },
      {
        role: "user",
        content: `Tema: ${input.topic}
Tom: ${TONE_GUIDE[tone]}
Objetivo: roteiro falado, o mais humano e natural possivel, para avatar em video.

Lembre:
- faca soar como alguem que domina o assunto e esta contando de forma descontraida
- varie o ritmo das frases — nao deixe todas do mesmo tamanho
- inclua pelo menos um detalhe concreto ou exemplo que torne o assunto real
- o texto precisa soar bem em voz alta, com fluencia natural`,
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
    max_tokens: 500,
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
