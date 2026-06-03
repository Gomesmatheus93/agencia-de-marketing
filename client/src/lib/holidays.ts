export type HolidayType = "national" | "state" | "municipal" | "international" | "commemorative";

export interface Holiday {
  id: string;
  name: string;
  type: HolidayType;
  description: string;
  marketingTip: string;
}

// Meeus/Jones/Butcher algorithm
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Returns the nth occurrence of weekday (0=Sun…6=Sat) in a given month
function nthWeekday(year: number, month: number, weekday: number, nth: number): Date {
  const firstDay = new Date(year, month - 1, 1);
  let offset = weekday - firstDay.getDay();
  if (offset < 0) offset += 7;
  return new Date(year, month - 1, 1 + offset + (nth - 1) * 7);
}

function fmt(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getHolidaysForYear(year: number): Map<string, Holiday[]> {
  const map = new Map<string, Holiday[]>();

  function add(date: Date, holiday: Holiday) {
    const key = fmt(date);
    const list = map.get(key) ?? [];
    list.push(holiday);
    map.set(key, list);
  }

  const easter = getEasterDate(year);
  const carnivalMon = addDays(easter, -48);
  const carnivalTue = addDays(easter, -47);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  const motherDay = nthWeekday(year, 5, 0, 2);   // 2nd Sunday of May
  const fatherDay = nthWeekday(year, 8, 0, 2);   // 2nd Sunday of August
  const blackFriday = nthWeekday(year, 11, 5, 4); // 4th Friday of November

  // ── Feriados Nacionais ────────────────────────────────────────────────────

  add(new Date(year, 0, 1), {
    id: "ano-novo",
    name: "Ano Novo",
    type: "national",
    description: "Confraternização Universal — início de um novo ano.",
    marketingTip: "Aposte em retrospectivas e metas para o novo ano. Peça de engajamento ou promoção de virada.",
  });

  add(carnivalMon, {
    id: "carnaval-seg",
    name: "Segunda de Carnaval",
    type: "national",
    description: "Feriado nacional informal — véspera do Carnaval.",
    marketingTip: "Use cores vibrantes e tema festivo. Ótimo para promoções relâmpago.",
  });

  add(carnivalTue, {
    id: "carnaval-ter",
    name: "Terça de Carnaval",
    type: "national",
    description: "Ponto facultativo — auge das festas de Carnaval.",
    marketingTip: "Conteúdo leve e divertido. Explore referências culturais nordestinas.",
  });

  add(goodFriday, {
    id: "sexta-santa",
    name: "Sexta-Feira Santa",
    type: "national",
    description: "Paixão de Cristo — feriado nacional.",
    marketingTip: "Tom reflexivo e respeitoso. Evite promoções agressivas; prefira conteúdo institucional.",
  });

  add(easter, {
    id: "pascoa",
    name: "Páscoa",
    type: "national",
    description: "Ressurreição de Cristo — uma das datas mais comerciais do ano.",
    marketingTip: "Explore chocolates, família e renovação. Campanhas de Páscoa convertem muito bem.",
  });

  add(new Date(year, 3, 21), {
    id: "tiradentes",
    name: "Tiradentes",
    type: "national",
    description: "Homenagem ao mártir da Inconfidência Mineira, Joaquim José da Silva Xavier.",
    marketingTip: "Conteúdo histórico e patriótico. Bom para branding institucional.",
  });

  add(new Date(year, 4, 1), {
    id: "dia-trabalho",
    name: "Dia do Trabalho",
    type: "national",
    description: "Celebração internacional dos trabalhadores.",
    marketingTip: "Valorize sua equipe publicamente. Ótimo para conteúdo employer branding.",
  });

  add(corpusChristi, {
    id: "corpus-christi",
    name: "Corpus Christi",
    type: "national",
    description: "Celebração católica do Santíssimo Sacramento.",
    marketingTip: "Tom respeitoso. Pode ser usado para reforçar valores da marca.",
  });

  add(new Date(year, 8, 7), {
    id: "independencia",
    name: "Independência do Brasil",
    type: "national",
    description: "7 de Setembro de 1822 — Proclamação da Independência por Dom Pedro I.",
    marketingTip: "Verde e amarelo! Promoções patrióticas têm alto engajamento nesta data.",
  });

  add(new Date(year, 9, 12), {
    id: "nossa-senhora",
    name: "Nossa Senhora Aparecida",
    type: "national",
    description: "Padroeira do Brasil — feriado nacional de devoção católica.",
    marketingTip: "Conteúdo de fé e gratidão. Cuidado com o tom — público muito diverso.",
  });

  add(new Date(year, 10, 2), {
    id: "finados",
    name: "Finados",
    type: "national",
    description: "Dia de celebração e memória dos falecidos.",
    marketingTip: "Evite promoções. Prefira mensagens de homenagem e reflexão.",
  });

  add(new Date(year, 10, 15), {
    id: "proclamacao-republica",
    name: "Proclamação da República",
    type: "national",
    description: "15 de Novembro de 1889 — proclamação da república brasileira.",
    marketingTip: "Conteúdo histórico e institucional. Bom para branding de marcas nacionais.",
  });

  add(new Date(year, 10, 20), {
    id: "consciencia-negra",
    name: "Dia da Consciência Negra",
    type: "national",
    description: "Homenagem a Zumbi dos Palmares e à luta do povo negro no Brasil.",
    marketingTip: "Conteúdo de inclusão e diversidade com autenticidade. Evite ações superficiais.",
  });

  add(new Date(year, 11, 25), {
    id: "natal",
    name: "Natal",
    type: "national",
    description: "Celebração do nascimento de Jesus Cristo — maior data comercial do ano.",
    marketingTip: "Início das campanhas de Natal em novembro. Capriche em criatividade e afeto.",
  });

  // ── Feriados Estaduais RN ─────────────────────────────────────────────────

  add(new Date(year, 0, 27), {
    id: "data-magna-rn",
    name: "Data Magna do RN",
    type: "state",
    description: "Rio Grande do Norte foi o primeiro estado a abolir a escravidão, em 1884.",
    marketingTip: "Feriado estadual com forte identidade local. Reforce o orgulho potiguar.",
  });

  // ── Feriados Municipais — Mossoró-RN ─────────────────────────────────────

  add(new Date(year, 5, 13), {
    id: "dia-liberdade-mossoro",
    name: "Dia da Liberdade de Mossoró",
    type: "municipal",
    description: "Em 30 de setembro de 1883, Mossoró foi a primeira cidade do Brasil a libertar os escravizados, sem indenização aos senhores. Também é dia de Santo Antônio, padroeiro da cidade.",
    marketingTip: "Data de grande orgulho local! Fale sobre a história de resistência da cidade.",
  });

  add(new Date(year, 5, 14), {
    id: "aniversario-mossoro",
    name: "Aniversário de Mossoró",
    type: "municipal",
    description: "Mossoró foi fundada em 14 de junho de 1852. A cidade é conhecida pela cultura, forró e tradição da resistência.",
    marketingTip: "Demonstre amor pela cidade! Conteúdo local tem altíssimo engajamento nesta data.",
  });

  add(new Date(year, 8, 30), {
    id: "resistencia-mossoro",
    name: "Dia da Resistência Mossoroense",
    type: "municipal",
    description: "30 de setembro de 1927 — Mossoró resistiu ao ataque de Lampião e seu bando, tornando-se símbolo de coragem.",
    marketingTip: "Tom de orgulho e identidade local. Explore a história de Mossoró Cidade Resistente.",
  });

  add(new Date(year, 11, 8), {
    id: "nossa-senhora-conceicao",
    name: "Nossa Senhora da Conceição",
    type: "municipal",
    description: "Padroeira do estado do Rio Grande do Norte — feriado municipal em Mossoró.",
    marketingTip: "Conteúdo de fé e devoção. Conecte-se com a identidade religiosa local.",
  });

  // ── Datas Internacionais ──────────────────────────────────────────────────

  add(new Date(year, 1, 14), {
    id: "dia-namorados-int",
    name: "Valentine's Day",
    type: "international",
    description: "Dia dos Namorados nos países anglófonos e em outros mercados internacionais.",
    marketingTip: "Se você atende mercados internacionais, antecipe campanhas de amor e presentes.",
  });

  add(new Date(year, 2, 8), {
    id: "dia-mulher",
    name: "Dia Internacional da Mulher",
    type: "international",
    description: "Data de luta pelos direitos e equidade das mulheres no mundo todo.",
    marketingTip: "Autenticidade é tudo. Destaque mulheres reais, histórias verdadeiras e causas concretas.",
  });

  add(new Date(year, 3, 22), {
    id: "dia-terra",
    name: "Dia da Terra",
    type: "international",
    description: "Dia Mundial do Meio Ambiente — conscientização sobre sustentabilidade.",
    marketingTip: "Mostre as práticas sustentáveis da empresa. Conteúdo educativo performa bem.",
  });

  add(new Date(year, 5, 5), {
    id: "dia-meio-ambiente",
    name: "Dia Mundial do Meio Ambiente",
    type: "international",
    description: "ONU — data global de sensibilização ambiental.",
    marketingTip: "Ações verdes e dicas de sustentabilidade. Bom para reputação de marca.",
  });

  add(new Date(year, 5, 28), {
    id: "dia-orgulho",
    name: "Dia do Orgulho LGBTQIA+",
    type: "international",
    description: "Marcha do Orgulho — data de visibilidade e luta por direitos da comunidade LGBTQIA+.",
    marketingTip: "Ações de inclusão com autenticidade. Posicionamentos vazios causam rejeição.",
  });

  add(new Date(year, 9, 31), {
    id: "halloween",
    name: "Halloween",
    type: "international",
    description: "Celebrado em 31 de outubro em países como EUA, Reino Unido, Irlanda e Canadá.",
    marketingTip: "Criatividade total! Fantasias, humor e mistério funcionam muito bem nas redes.",
  });

  add(new Date(year, 10, 11), {
    id: "dia-solteiro",
    name: "Dia do Solteiro / Singles Day",
    type: "international",
    description: "Originado na China (11/11) — maior data de e-commerce do mundo.",
    marketingTip: "Promoções relâmpago e descontos agressivos. Perfeito para e-commerce.",
  });

  add(new Date(year, 11, 1), {
    id: "dia-aids",
    name: "Dia Mundial de Luta contra a AIDS",
    type: "international",
    description: "Laço vermelho — data de conscientização sobre o HIV/AIDS.",
    marketingTip: "Conteúdo educativo e de conscientização com responsabilidade.",
  });

  // ── Datas Comemorativas (Marketing) ──────────────────────────────────────

  add(motherDay, {
    id: "dia-maes",
    name: "Dia das Mães",
    type: "commemorative",
    description: "2º domingo de maio — uma das datas mais importantes do varejo brasileiro.",
    marketingTip: "Comece a campanha 2 semanas antes. Emoção e gratidão têm altíssimo engajamento.",
  });

  add(new Date(year, 5, 12), {
    id: "dia-namorados",
    name: "Dia dos Namorados",
    type: "commemorative",
    description: "12 de junho — celebração dos casais no Brasil.",
    marketingTip: "Antecipe com promoções de presente e experiências para casais.",
  });

  add(fatherDay, {
    id: "dia-pais",
    name: "Dia dos Pais",
    type: "commemorative",
    description: "2º domingo de agosto — segunda maior data do varejo após o Natal.",
    marketingTip: "Kits presentes e experiências. Comece a campanha na semana anterior.",
  });

  add(new Date(year, 8, 15), {
    id: "dia-cliente",
    name: "Dia do Cliente",
    type: "commemorative",
    description: "15 de setembro — data para valorizar e fidelizar clientes.",
    marketingTip: "Programas de fidelidade, descontos exclusivos para base de clientes.",
  });

  add(new Date(year, 9, 15), {
    id: "dia-professores",
    name: "Dia dos Professores",
    type: "commemorative",
    description: "15 de outubro — homenagem aos educadores brasileiros.",
    marketingTip: "Conteúdo de gratidão. Ótimo para nichos de educação e cursos.",
  });

  add(new Date(year, 10, 24), {
    id: "vespera-natal",
    name: "Véspera de Natal",
    type: "commemorative",
    description: "Noite de 24 de dezembro — celebração em família.",
    marketingTip: "Última chance de mensagem natalina antes do grande dia.",
  });

  add(blackFriday, {
    id: "black-friday",
    name: "Black Friday",
    type: "commemorative",
    description: "4ª sexta-feira de novembro — maior evento de descontos do ano.",
    marketingTip: "Planeje com 3+ semanas de antecedência. Autenticidade nos descontos evita rejeição.",
  });

  add(new Date(year, 11, 31), {
    id: "reveillon",
    name: "Réveillon",
    type: "commemorative",
    description: "Virada de Ano — celebração da chegada do novo ano.",
    marketingTip: "Retrospectiva do ano, desejos e metas. Conteúdo emocional performa muito bem.",
  });

  return map;
}

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  national: "Nacional",
  state: "Estadual (RN)",
  municipal: "Municipal (Mossoró)",
  international: "Internacional",
  commemorative: "Comemorativo",
};

export const HOLIDAY_TYPE_COLORS: Record<HolidayType, { dot: string; badge: string; card: string }> = {
  national: {
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    card: "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20",
  },
  state: {
    dot: "bg-teal-500",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    card: "border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20",
  },
  municipal: {
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    card: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20",
  },
  international: {
    dot: "bg-purple-500",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    card: "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20",
  },
  commemorative: {
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    card: "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20",
  },
};
