/**
 * Catálogo dos modelos de arte da biblioteca de referências
 * (server/agents/skills/alle-design/referencias.md). As prévias ficam em
 * client/public/modelos/<id>.webp e são geradas por scripts/build-model-previews.mts.
 */
export type DesignModelGroup = "dados" | "explicar" | "objecoes" | "dicas" | "emocao" | "engajamento" | "noticias";

export type DesignModel = {
  id: string;
  name: string;
  group: DesignModelGroup;
  summary: string;
};

export const DESIGN_MODEL_GROUPS: Record<DesignModelGroup, string> = {
  dados: "Dados e economia",
  explicar: "Explicar e ensinar",
  objecoes: "Objeções e mitos",
  dicas: "Dicas salváveis",
  emocao: "Emoção, marca e datas",
  engajamento: "Engajamento",
  noticias: "Notícias do setor",
};

export const DESIGN_MODELS: DesignModel[] = [
  { id: "M01", name: "Número gigante", group: "dados", summary: "Um número ocupa metade da arte, com a frase que dá sentido a ele." },
  { id: "M10", name: "Simulação de economia", group: "dados", summary: "Card com a conta de exemplo e a economia em 1 mês, 1 ano e 5 anos." },
  { id: "M11", name: "Mapa com destaque", group: "dados", summary: "Mapa do Brasil com a região que importa em laranja." },
  { id: "M12", name: "Sem a Alle × Com a Alle", group: "dados", summary: "Duas colunas: o jeito antigo apagado e a Alle em destaque." },
  { id: "M23", name: "Barras ou degraus", group: "dados", summary: "Gráfico simples, como a escada das bandeiras tarifárias." },
  { id: "M07", name: "Linha contínua", group: "explicar", summary: "Uma linha laranja atravessa o carrossel e liga um slide ao outro." },
  { id: "M08", name: "Documento anotado", group: "explicar", summary: "A conta de luz no centro com caixas explicando cada parte." },
  { id: "M09", name: "Fluxo / diagrama", group: "explicar", summary: "Etapas ligadas por setas: usina, rede, créditos, sua conta." },
  { id: "M21", name: "Etapas com selo", group: "explicar", summary: "Selo \"PASSO X DE 4\", título curto e objeto sobre um semicírculo." },
  { id: "M22", name: "Quadrinhos", group: "explicar", summary: "Tirinha em que o cliente tira dúvidas com a Ane, com balões de fala." },
  { id: "M03", name: "Mito ou verdade", group: "objecoes", summary: "Afirmações em pílulas com selos ✗ e ✓." },
  { id: "M04", name: "Antes × Depois", group: "objecoes", summary: "Arte dividida ao meio: o antes apagado e o depois colorido." },
  { id: "M05", name: "Balões de dúvida", group: "objecoes", summary: "Perguntas em balões de chat e a resposta em destaque." },
  { id: "M18", name: "Prós × Contras", group: "objecoes", summary: "Interface com interruptor de prós e contras em cards." },
  { id: "M19", name: "Você quis dizer:", group: "objecoes", summary: "Barra de busca com o termo errado e a correção." },
  { id: "M02", name: "Dica com ícone", group: "dicas", summary: "Ícone de linha grande, a dica em destaque e o porquê." },
  { id: "M06", name: "Textura + título", group: "dicas", summary: "Foto de textura com camada roxa, título curto e seta." },
  { id: "M13", name: "Bloco de notas", group: "dicas", summary: "Imitação de um app de notas com checklist, feito para salvar." },
  { id: "M20", name: "Grade de ícones", group: "dicas", summary: "Cards com ícones e rótulos curtos numa grade." },
  { id: "M14", name: "Série emocional", group: "emocao", summary: "Foto do dia a dia e a frase \"Energia que…\" no topo." },
  { id: "M15", name: "Foto com recorte curvo", group: "emocao", summary: "Foto em arco e moldura de linha laranja ao redor do título." },
  { id: "M16", name: "Palavra repetida", group: "emocao", summary: "\"ENERGIA\" três vezes com o raio da marca na frente." },
  { id: "M17", name: "Card de data", group: "emocao", summary: "Cor chapada e uma frase grande, minimalista." },
  { id: "M29", name: "Foto conceitual", group: "emocao", summary: "Um objeto do dia a dia como metáfora, em cor chapada." },
  { id: "M30", name: "Foto dividida ao meio", group: "emocao", summary: "Duas fotos que se completam lado a lado." },
  { id: "M24", name: "Pergunta para comentários", group: "engajamento", summary: "Uma pergunta grande que pede resposta nos comentários." },
  { id: "M25", name: "Comente e receba", group: "engajamento", summary: "Palavra-chave em destaque para comentar e receber no direct." },
  { id: "M26", name: "Jogo / escolha", group: "engajamento", summary: "\"Escolha 1 letra e 1 número\" sobre uma grade de cards." },
  { id: "M27", name: "Notícia em formato portal", group: "noticias", summary: "Foto, chip de categoria e manchete em faixa branca." },
  { id: "M28", name: "Recorte de manchetes", group: "noticias", summary: "Recortes de papel inclinados com o título da Alle por cima." },
];

export const DESIGN_MODEL_IDS = DESIGN_MODELS.map((m) => m.id);

export function designModelById(id: string | undefined | null): DesignModel | undefined {
  return id ? DESIGN_MODELS.find((m) => m.id === id) : undefined;
}
