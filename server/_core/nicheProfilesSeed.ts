export type NicheVisualGrammar = {
  framing?: string[];
  lighting?: string;
  color_tendency?: string[];
  composition?: string;
  avoid?: string[];
};

export type NicheProfile = {
  id: string;
  label: string;
  version: number;
  subNiches: { id: string; label: string }[];
  visualGrammar: NicheVisualGrammar;
  copyTone: { voice: string; common_triggers: string[]; words_to_avoid: string[] };
  referenceImageTags: string[];
  carouselPatterns: string[];
  keywords: string[];
};

export const NICHE_PROFILES: NicheProfile[] = [
  {
    id: "estetica_beleza",
    label: "Estética & Beleza",
    version: 1,
    subNiches: [
      { id: "clinica_dermato", label: "Clínica de Dermatologia" },
      { id: "salao_beleza", label: "Salão de Beleza" },
      { id: "spa_wellness", label: "Spa & Wellness" },
      { id: "odonto_estetica", label: "Odontologia Estética" },
      { id: "maquiagem_artista", label: "Maquiagem & Artista" },
    ],
    visualGrammar: {
      framing: [
        "close-up de pele/rosto com skin texture visível",
        "detalhe de procedimento — mãos do profissional em ação",
        "ambiente clínico ou spa — clean, minimalista",
        "produto cosmético hero shot em fundo neutro",
      ],
      lighting: "difusa, suave, sem sombras duras; 4000–5000K clínica; 2700–3500K spa/salão; highlight natural em pele",
      color_tendency: ["#F5E6D8 nude", "#FFFFFF branco clínico", "#D4AF82 dourado sutil", "#E8C9B0 pele médio"],
      composition: "espaço negativo generoso (mínimo 30%), profundidade de campo rasa (f/1.4–2.8), sujeito no terço superior",
      avoid: [
        "contraste duro ou HDR exagerado",
        "fundos poluídos ou coloridos",
        "textos grandes sobrepostos ao rosto",
        "filtros Instagram supersaturados",
        "modelos evidentemente stock photo",
      ],
    },
    copyTone: {
      voice: "acolhedor, confiança técnica, autoridade sem frieza clínica",
      common_triggers: ["autoestima", "autocuidado", "resultado visível e natural", "segurança do procedimento certificado"],
      words_to_avoid: ["milagroso", "instantâneo", "antes/depois chocante"],
    },
    referenceImageTags: ["skincare editorial soft light", "beauty clinic minimal aesthetic", "spa ambient warm light", "cosmetics flat lay white background"],
    carouselPatterns: ["antes/depois ético (protocolo, não choque)", "passo a passo de procedimento", "mitos vs. verdades", "depoimento com resultado real"],
    keywords: ["beleza", "estética", "skincare", "cosméticos", "dermatologia", "clínica", "spa", "salão", "odontologia", "maquiagem", "beauty"],
  },
  {
    id: "imobiliario",
    label: "Imobiliário",
    version: 1,
    subNiches: [
      { id: "lancamento_construtora", label: "Lançamento / Construtora" },
      { id: "corretor_autonomo", label: "Corretor Autônomo" },
      { id: "imovel_luxo", label: "Imóvel de Alto Padrão" },
      { id: "aluguel_temporada", label: "Aluguel de Temporada" },
      { id: "comercial", label: "Imóvel Comercial" },
    ],
    visualGrammar: {
      framing: [
        "grande angular de interiores para transmitir amplitude",
        "exterior golden hour (16h–18h)",
        "detalhe arquitetônico premium (mármore, madeira, vista)",
        "drone shot 45° sobre o empreendimento",
      ],
      lighting: "natural preferencial; golden hour exterior; luz difusa nublada para interiores; evitar flash direto",
      color_tendency: ["#F0EAE0 off-white quente", "#C9B99A areia/caramelo", "#2C3E50 azul-petróleo", "#7FB3A8 verde-água sutil"],
      composition: "linhas de fuga pronunciadas para ampliar espaço; horizonte no terço inferior; céu como espaço negativo",
      avoid: [
        "objetos pessoais do morador visíveis",
        "iluminação amarelada sem correção de branco",
        "distorção excessiva olho-de-peixe",
        "selfie do corretor na frente do imóvel",
        "fotos de banheiro com tampo do vaso aberto",
      ],
    },
    copyTone: {
      voice: "aspiracional, concreto, transparência técnica; alto padrão: reservado e sem superlativos",
      common_triggers: ["realização de sonho", "localização estratégica", "valorização patrimonial", "documentação em ordem"],
      words_to_avoid: ["barato", "imperdível", "corra", "financiamento fácil"],
    },
    referenceImageTags: ["real estate photography golden hour", "luxury interior natural light", "aerial drone property shot", "modern kitchen architectural photography"],
    carouselPatterns: ["tour virtual por ambiente", "localização + entorno + diferenciais", "planta baixa comentada", "depoimento de comprador"],
    keywords: ["imóvel", "imobiliário", "corretor", "apartamento", "casa", "construtora", "real estate", "propriedade", "aluguel"],
  },
  {
    id: "gastronomia",
    label: "Gastronomia",
    version: 1,
    subNiches: [
      { id: "restaurante_fino", label: "Fine Dining" },
      { id: "restaurante_casual", label: "Casual / Bistrô" },
      { id: "delivery_fast", label: "Delivery / Fast Casual" },
      { id: "confeitaria", label: "Confeitaria & Bakery" },
      { id: "chef_personal", label: "Chef Personal / Gastronomia Autoral" },
    ],
    visualGrammar: {
      framing: [
        "overhead flat lay (90°) para pratos compostos",
        "45° menu shot clássico — ângulo padrão de food photography",
        "macro de textura (crocância, derretimento, camadas)",
        "processo de preparo — mãos do chef, fumaça, movimento",
      ],
      lighting: "luz natural lateral preferencial; difusor para sombras suaves; 3200–4500K; nunca flash direto",
      color_tendency: ["#D4380D vermelho tomate", "#F5A623 âmbar quente", "#2D5016 verde erva fresca", "#FFF8F0 creme fundo clean"],
      composition: "bokeh com elementos desfocados ao fundo; props complementares (talheres, linho, ervas); altura variada entre elementos no frame",
      avoid: [
        "comida fria com aspecto ressecado",
        "filtro excessivo amarelo ou azul dominante",
        "prato centralizado sem contexto (fundo branco genérico)",
        "watermark grande sobre o alimento",
        "foto do cardápio plastificado",
      ],
    },
    copyTone: {
      voice: "sensorial, evocativo; fine dining: contido e sofisticado; delivery: direto, apetitoso, leve humor",
      common_triggers: ["experiência sensorial (cheiro, textura, temperatura)", "ingredientes de origem", "ocasião especial", "chef / técnica como diferencial"],
      words_to_avoid: ["delicioso (batido)", "irresistível (batido)", "o melhor da cidade (sem evidência)"],
    },
    referenceImageTags: ["food photography natural light overhead", "restaurant editorial fine dining", "macro texture close-up food", "chef hands cooking action shot"],
    carouselPatterns: ["cardápio semanal (1 prato por slide)", "behind the scenes de preparo", "ingrediente hero + origem + receita", "menu degustação — passo a passo dos pratos"],
    keywords: ["restaurante", "gastronomia", "food", "culinária", "chef", "delivery", "confeitaria", "bistro", "café", "padaria", "comida", "prato"],
  },
  {
    id: "saude_bemestar",
    label: "Saúde & Bem-estar",
    version: 1,
    subNiches: [
      { id: "fitness_academia", label: "Fitness & Academia" },
      { id: "nutricao", label: "Nutrição" },
      { id: "psicologia", label: "Psicologia & Saúde Mental" },
      { id: "odontologia_clinica", label: "Odontologia Clínica" },
      { id: "medicina_preventiva", label: "Medicina Preventiva" },
    ],
    visualGrammar: {
      framing: ["ambiente clínico clean e moderno", "ação/movimento fitness em treino real", "alimento saudável em fundo neutro"],
      lighting: "luz natural suave ou difusa; paleta bright e positiva",
      color_tendency: ["#FFFFFF branco clínico", "#4CAF50 verde saúde", "#2196F3 azul confiança", "#F5F5F5 cinza claro"],
      composition: "clean, minimalista, espaço negativo generoso; profissional em posição de autoridade",
      avoid: ["imagens genéricas de banco (modelos sorrindo artificialmente)", "infográficos poluídos", "cores agressivas sem necessidade"],
    },
    copyTone: {
      voice: "empático, confiável, ciência-embasado",
      common_triggers: ["qualidade de vida", "prevenção", "resultado comprovado", "bem-estar sustentável"],
      words_to_avoid: ["milagroso", "cura garantida", "resultado imediato"],
    },
    referenceImageTags: ["health wellness minimal clean", "fitness lifestyle natural light", "nutrition food clean aesthetic", "medical professional modern"],
    carouselPatterns: ["mitos vs. verdades do segmento", "passo a passo de exercício ou protocolo", "dicas nutricionais com ciência", "depoimento de paciente"],
    keywords: ["saúde", "fitness", "academia", "nutrição", "psicologia", "médico", "odontologia", "bem-estar", "exercício", "health"],
  },
  {
    id: "moda_ecommerce",
    label: "Moda & E-commerce",
    version: 1,
    subNiches: [
      { id: "moda_feminina", label: "Moda Feminina" },
      { id: "moda_masculina", label: "Moda Masculina" },
      { id: "calcados_acessorios", label: "Calçados & Acessórios" },
      { id: "moda_sustentavel", label: "Moda Sustentável" },
    ],
    visualGrammar: {
      framing: ["flat lay editorial de produto", "modelo usando a peça em contexto lifestyle", "detalhe de textura/tecido"],
      lighting: "luz natural suave ou estúdio com softbox; reprodução de cor precisa",
      color_tendency: ["#000000 preto editorial", "#FFFFFF branco clean", "tons neutros sazonais da coleção"],
      composition: "produto como protagonista absoluto; espaço negativo para texto; proporção áurea",
      avoid: ["fundos poluídos ou texturas que competem com a peça", "iluminação inconsistente entre itens da mesma coleção"],
    },
    copyTone: {
      voice: "aspiracional, trendy, direto — fala no idioma do target",
      common_triggers: ["estilo de vida", "exclusividade / lançamento", "nova coleção", "tendência da temporada"],
      words_to_avoid: ["barato", "promoçãozinha", "qualquer moda"],
    },
    referenceImageTags: ["fashion editorial flat lay", "clothing lifestyle model natural light", "fashion brand aesthetic clean minimal"],
    carouselPatterns: ["look do dia (1 peça por slide)", "combinações de peças da coleção", "bastidores da produção", "depoimento de cliente com foto"],
    keywords: ["moda", "fashion", "roupa", "vestuário", "acessório", "calçado", "boutique", "loja", "coleção", "estilo"],
  },
  {
    id: "educacao_cursos",
    label: "Educação & Cursos",
    version: 1,
    subNiches: [
      { id: "infoproduto", label: "Infoproduto / Curso Online" },
      { id: "escola_presencial", label: "Escola / Centro de Treinamento" },
      { id: "coaching", label: "Coaching & Mentoria" },
    ],
    visualGrammar: {
      framing: ["professor/especialista em posição de autoridade confiante", "aluno aplicando o aprendizado", "material didático clean e organizado"],
      lighting: "bright, positivo, energético — transmite crescimento",
      color_tendency: ["#3B82F6 azul confiança", "#10B981 verde crescimento", "#F59E0B âmbar energia", "#FFFFFF fundos limpos"],
      composition: "clean, progressão visual clara; especialista à esquerda, resultado/solução à direita",
      avoid: ["slides de apresentação genéricos como fundo de foto", "imagens de lousa escolar estereotipada", "stock de pessoas felizes sem contexto"],
    },
    copyTone: {
      voice: "transformador, prático, resultadista — foco no antes/depois do aluno",
      common_triggers: ["mudança de vida", "habilidade nova em semanas", "transformação comprovada", "acesso ao especialista"],
      words_to_avoid: ["get rich quick", "fácil demais", "sem esforço"],
    },
    referenceImageTags: ["online course professional clean", "educational content creator", "learning digital modern", "mentor student transformation"],
    carouselPatterns: ["3 erros comuns do iniciante", "transformação de aluno (antes/depois)", "conteúdo gratuito com CTA para produto", "dica do especialista em 5 slides"],
    keywords: ["curso", "educação", "coaching", "mentoria", "treinamento", "infoproduto", "aprendizado", "aula", "certificação"],
  },
  {
    id: "tecnologia_saas",
    label: "Tecnologia & SaaS",
    version: 1,
    subNiches: [
      { id: "startup", label: "Startup" },
      { id: "software_saas", label: "Software / SaaS" },
      { id: "consultoria_ti", label: "Consultoria de TI" },
    ],
    visualGrammar: {
      framing: ["interface do produto em tela (mockup device)", "equipe tech em ambiente moderno", "ícone/símbolo abstrato do produto"],
      lighting: "artificial moderna — tons frios azulados ou dark mode com glow neon",
      color_tendency: ["#1E1B4B índigo escuro", "#6366F1 roxo tech", "#06B6D4 ciano elétrico", "#0D1117 dark background"],
      composition: "grid, simetria, proporções precisas; muito espaço negativo; tipografia técnica em destaque",
      avoid: ["stock photos de aperto de mão corporativo", "imagens de servidor físico genérico", "clipart de nuvem", "paleta super colorida sem identidade"],
    },
    copyTone: {
      voice: "preciso, confiante, inovador — foco em resultado mensurável",
      common_triggers: ["eficiência operacional", "automação de processo", "escala sem custo proporcional", "ROI em semanas"],
      words_to_avoid: ["revolucionário (sem evidência)", "único no mundo (sem prova)", "solução completa"],
    },
    referenceImageTags: ["saas product ui dark modern", "tech startup clean minimal", "software interface mockup device", "technology brand identity"],
    carouselPatterns: ["feature highlight com screenshot", "caso de uso / use case", "comparativo antes/depois de adotar o produto", "números e métricas de impacto"],
    keywords: ["tech", "software", "startup", "SaaS", "tecnologia", "app", "plataforma", "sistema", "automação", "digital"],
  },
  {
    id: "juridico_servicos",
    label: "Jurídico & Serviços Profissionais",
    version: 1,
    subNiches: [
      { id: "advogado", label: "Advogado / Escritório" },
      { id: "contabilidade", label: "Contabilidade" },
      { id: "consultoria_empresarial", label: "Consultoria Empresarial" },
    ],
    visualGrammar: {
      framing: ["profissional em ambiente corporativo sóbrio", "escritório moderno com boa iluminação", "detalhe de documento/objeto relevante"],
      lighting: "natural, formal, sem exageros; tons frios/neutros que transmitem seriedade",
      color_tendency: ["#1E293B azul-petróleo escuro", "#0F172A quase-preto", "#94A3B8 cinza azulado neutro"],
      composition: "conservador, formal, muito espaço negativo; tipografia clean em primeiro plano",
      avoid: ["emoticons em excesso", "fundos coloridos vibrantes", "infográficos amadores", "linguagem muito informal"],
    },
    copyTone: {
      voice: "formal, confiável, técnico mas acessível ao cliente leigo",
      common_triggers: ["segurança jurídica", "proteção patrimonial", "conformidade regulatória", "expertise comprovada"],
      words_to_avoid: ["garantia de resultado (risco ético/jurídico)", "barato", "rapidinho"],
    },
    referenceImageTags: ["law firm professional corporate", "legal services minimal clean", "professional services corporate modern"],
    carouselPatterns: ["explicação de direito em linguagem acessível", "alerta de prazo legal", "mudança na legislação + impacto prático", "case de sucesso"],
    keywords: ["jurídico", "advogado", "direito", "advocacia", "contabilidade", "consultoria", "assessoria", "lei", "processo"],
  },
  {
    id: "automotivo",
    label: "Automotivo",
    version: 1,
    subNiches: [
      { id: "concessionaria", label: "Concessionária" },
      { id: "oficina_mecanica", label: "Oficina Mecânica" },
      { id: "acessorios_auto", label: "Acessórios Automotivos" },
    ],
    visualGrammar: {
      framing: ["carro em ângulo 3/4 dianteiro — clássico automotivo", "detalhe de peça, roda ou interior premium", "ação (veículo em movimento com motion blur controlado)"],
      lighting: "sunset / golden hour outdoor ou estúdio com reflexo no capô; high contrast dramático",
      color_tendency: ["#0A0A0A preto absoluto", "#FF6B00 laranja esportivo", "#C0C0C0 prata metálico", "#1A1A2E azul marinho"],
      composition: "veículo ocupa 70%+ do frame; linha do horizonte baixa; perspectiva dinâmica",
      avoid: ["carros amassados ou sujos no fundo da cena", "filtros que distorcem cor real do veículo", "fotos de interior mal iluminadas"],
    },
    copyTone: {
      voice: "performance, segurança, orgulho de posse — evoca sensação de dirigir",
      common_triggers: ["potência e desempenho", "conforto da família", "segurança ativa/passiva", "facilidade de financiamento"],
      words_to_avoid: ["mais barato que a concorrência (canibaliza valor)"],
    },
    referenceImageTags: ["car photography studio dramatic lighting", "automotive advertising golden hour", "vehicle detail shot premium", "cars in motion"],
    carouselPatterns: ["destaque de features do veículo", "comparativo de versões / trims", "processo de vistoria / revisão", "depoimento de cliente"],
    keywords: ["carro", "veículo", "automotivo", "concessionária", "moto", "oficina", "mecânico", "automóvel", "sedan", "suv"],
  },
  {
    id: "varejo_local",
    label: "Varejo Local",
    version: 1,
    subNiches: [
      { id: "supermercado", label: "Supermercado / Mercearia" },
      { id: "loja_roupas_local", label: "Loja de Roupas" },
      { id: "farmacia", label: "Farmácia" },
      { id: "petshop", label: "Pet Shop" },
    ],
    visualGrammar: {
      framing: ["produto em destaque bem iluminado", "oferta com preço em evidência clara", "ambiente da loja organizado"],
      lighting: "iluminação de ponto de venda bem exposto; sem sombras escuras; branco consistente",
      color_tendency: ["cores de varejo: vermelho, amarelo, laranja para promoções", "#FFFFFF fundos limpos para produto"],
      composition: "produto centralizado com preço legível; CTA visível em distância de rolagem",
      avoid: ["fotos desfocadas ou mal iluminadas", "produto pequeno demais no frame", "fundos bagunçados atrás do produto"],
    },
    copyTone: {
      voice: "direto, promoção clara, urgência leve, linguagem popular e acessível",
      common_triggers: ["preço atrativo", "promoção por tempo limitado", "conveniência de bairro", "qualidade comprovada"],
      words_to_avoid: ["exclusivo (se for varejo de massa)", "premium (contradiz preço popular)"],
    },
    referenceImageTags: ["retail store product promotion vibrant", "local store social media sale", "supermarket offer display"],
    carouselPatterns: ["oferta da semana (1 produto por slide)", "novidades que chegaram", "dica de uso do produto", "combinações / receitas com os produtos"],
    keywords: ["varejo", "loja", "supermercado", "farmácia", "pet shop", "comércio", "promoção", "desconto", "ofertas"],
  },
  {
    id: "energia_utilities",
    label: "Energia & Serviços",
    version: 1,
    subNiches: [
      { id: "energia_solar", label: "Energia Solar" },
      { id: "construcao_civil", label: "Construção Civil" },
      { id: "manutencao_predial", label: "Manutenção Predial" },
    ],
    visualGrammar: {
      framing: ["instalação em ação (profissional no telhado ou obra)", "produto técnico em detalhe", "resultado final (casa/empresa com painéis)"],
      lighting: "exterior com luz do sol natural; transmite sustentabilidade e futuro",
      color_tendency: ["#F59E0B âmbar solar", "#1D4ED8 azul solar", "#10B981 verde sustentável", "#1F2937 cinza técnico"],
      composition: "mostra escala — instalação no contexto real do imóvel ou obra",
      avoid: ["imagens genéricas de painéis de banco de fotos", "fundo branco sem contexto para serviço de instalação"],
    },
    copyTone: {
      voice: "econômico, sustentável, técnico confiável — foco em economia real",
      common_triggers: ["economia na conta de luz", "retorno do investimento em meses", "independência energética", "valorização do imóvel"],
      words_to_avoid: ["gratuito (sem deixar claro as condições)", "sem custo"],
    },
    referenceImageTags: ["solar energy installation residential", "renewable energy professional photography", "construction work professional clean"],
    carouselPatterns: ["cálculo de economia personalizado", "antes/depois da instalação", "depoimento de cliente com números reais", "etapas do processo de instalação"],
    keywords: ["energia solar", "solar", "construção", "engenharia", "utilities", "elétrica", "manutenção", "painéis solares"],
  },
];

export function detectNicheIdFromText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  for (const profile of NICHE_PROFILES) {
    if (profile.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return profile.id;
    }
  }
  return undefined;
}

export function getNicheProfileById(id: string): NicheProfile | undefined {
  return NICHE_PROFILES.find((p) => p.id === id);
}
