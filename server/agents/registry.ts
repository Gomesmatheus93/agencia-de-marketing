// Catálogo dos agentes internos. Cada agente é uma skill de server/agents/skills
// (copiadas de github.com/Jakeschincariol/instagram-agent-skill, MIT) mais as
// ferramentas da plataforma (server/agents/tools.ts).

export type AgentDefinition = {
  slug: string;
  name: string;
  role: string;
  description: string;
  /** Pasta da skill em server/agents/skills. */
  skill: string;
  /** Sugestões de primeira mensagem exibidas na tela do agente. */
  starters: string[];
};

export const AGENTS: AgentDefinition[] = [
  {
    slug: "auditoria",
    name: "Agente de Auditoria",
    role: "Análise de desempenho",
    description: "Faz o pós-morte do que já foi publicado: o que funcionou, por quê e o que parar de fazer.",
    skill: "ig-audit",
    starters: [
      "Audite os últimos 30 posts do Instagram da Alle",
      "Quais formatos e temas estão performando melhor?",
    ],
  },
  {
    slug: "planejamento",
    name: "Agente de Planejamento",
    role: "Estratégia e calendário",
    description: "Monta o plano de postagens: o que postar, em qual formato, quando e com quem interagir.",
    skill: "ig-plan",
    starters: [
      "Planeje a próxima semana de posts da Alle",
      "Monte o planejamento do mês com base no que já performou",
    ],
  },
  {
    slug: "legendas",
    name: "Agente de Legendas",
    role: "Copywriting",
    description: "Escreve a legenda que sobrevive ao corte do \"... mais\", com um único CTA e poucas hashtags, e revisa antes de entregar.",
    skill: "ig-caption",
    starters: [
      "Escreva a legenda de um post sobre economia na conta de luz",
      "Revise esta legenda: …",
    ],
  },
  {
    slug: "carrossel",
    name: "Agente de Carrossel",
    role: "Conteúdo em slides",
    description: "Cria carrosséis: a capa que faz deslizar, o texto de cada slide, o resumo e o CTA.",
    skill: "ig-carousel",
    starters: [
      "Crie um carrossel explicando como funciona a energia por assinatura",
      "Transforme esta ideia em carrossel: …",
    ],
  },
  {
    slug: "reels",
    name: "Agente de Reels",
    role: "Roteiro de vídeo",
    description: "Transforma uma ideia em Reel: três ganchos pontuados, roteiro falado, textos na tela e tempo de cada cena.",
    skill: "ig-reel",
    starters: [
      "Crie um Reel sobre os benefícios da energia solar compartilhada",
      "Me dê 3 ganchos para um Reel sobre conta de luz cara",
    ],
  },
  {
    slug: "stories",
    name: "Agente de Stories",
    role: "Sequência diária",
    description: "Escreve a sequência de stories do dia, com qual figurinha usar em cada quadro e o funil para o Direct.",
    skill: "ig-story",
    starters: ["Monte os stories de hoje da Alle", "Crie uma sequência de stories com enquete sobre a conta de luz"],
  },
  {
    slug: "pesquisa-viral",
    name: "Agente de Pesquisa Viral",
    role: "Referências do nicho",
    description: "Encontra o que está funcionando no nicho, ranqueia pelo quanto cada post superou a média da própria conta e monta o arquivo de referências.",
    skill: "ig-viral",
    starters: ["Quero montar um arquivo de referências do nicho de energia", "Analise estes reels que performaram: …"],
  },
  {
    slug: "perfil",
    name: "Agente de Perfil",
    role: "Otimização do perfil",
    description: "Dá nota de 0 a 100 ao perfil numa rubrica de 12 itens e reescreve o que perde pontos: nome, bio, link, destaques, fixados.",
    skill: "ig-profile",
    starters: ["Avalie o perfil do Instagram da Alle", "Reescreva a bio da Alle"],
  },
  {
    slug: "humanizador",
    name: "Agente Humanizador",
    role: "Revisão de texto",
    description: "Tira a cara de texto de IA de qualquer rascunho e pontua o resultado em cinco verificações antes de sair.",
    skill: "ig-human",
    starters: ["Humanize este texto: …", "Este texto parece escrito por IA? …"],
  },
  {
    slug: "respostas",
    name: "Agente de Respostas",
    role: "Comentários nos nossos posts",
    description: "Tria os comentários dos nossos posts (palavra-chave, lead, dúvida, apoio, ruído) e escreve as respostas na ordem certa.",
    skill: "ig-reply",
    starters: ["Responda estes comentários: …"],
  },
  {
    slug: "comentarios",
    name: "Agente de Comentários",
    role: "Engajamento em outros perfis",
    description: "Escreve comentários em posts de outros perfis que soam como alguém com opinião, não como robô.",
    skill: "ig-comment",
    starters: ["Escreva um comentário para este post: …"],
  },
  {
    slug: "direct",
    name: "Agente de Direct",
    role: "Mensagens (DM)",
    description: "Escreve DMs que recebem resposta: entrega por palavra-chave, primeira mensagem, proposta de parceria e os dois follow-ups.",
    skill: "ig-dm",
    starters: ["Escreva a DM para quem comentou a palavra-chave", "Crie uma proposta de parceria para @…"],
  },
  {
    slug: "reaproveitamento",
    name: "Agente de Reaproveitamento",
    role: "Conteúdo longo → posts",
    description: "Transforma um conteúdo longo (vídeo, podcast, artigo, apresentação) numa semana de reels e carrosséis independentes.",
    skill: "ig-repurpose",
    starters: ["Transforme este texto em uma semana de posts: …"],
  },
];

export function getAgent(slug: string): AgentDefinition | undefined {
  return AGENTS.find((a) => a.slug === slug);
}
