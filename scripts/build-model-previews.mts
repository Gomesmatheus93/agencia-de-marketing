/**
 * Gera as prévias dos modelos da biblioteca de referências (shared/designModels.ts)
 * em client/public/modelos/<id>.webp. Cada prévia é uma arte de exemplo no visual da
 * Alle, renderizada pelo mesmo motor das artes dos agentes.
 *
 *   npx tsx --env-file=.env scripts/build-model-previews.mts [M01 M07 ...]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { renderDesign } from "../server/agents/design/render";
import { searchStockPhotos } from "../server/agents/design/photos";

const OUT = path.resolve(import.meta.dirname, "../client/public/modelos");
const W = 1080, H = 1350;
const ROXO = "#7B2FBE", ROXO_ESC = "#44015e", ROXO_TXT = "#7c00ae", LIL = "#E9D7F7";
const LAR = "#F47B20", LAR_TXT = "#ff7300", CLARO = "#FFF8F2", ESCURO = "#1E0A01";
const VERDE = "#2EB872", VERM = "#E5484D";
const F = 'font-family="Montserrat"';

// ─── Peças comuns ─────────────────────────────────────────────────────────────

const t = (arr: string[], x: number, y: number, size: number, lh: number, weight: number, fill: string, extra = "") =>
  `<text ${F} font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${arr.map((l, i) => `<tspan x="${x}" ${i ? `dy="${lh}"` : `y="${y}"`}>${l}</tspan>`).join("")}</text>`;
const chip = (label: string, x: number, y: number, w: number, bg: string, fg: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="56" rx="28" fill="${bg}"/><text x="${x + w / 2}" y="${y + 38}" text-anchor="middle" ${F} font-weight="800" font-size="24" letter-spacing="3" fill="${fg}">${label}</text>`;
const handle = (fill: string) => `<text x="80" y="1270" ${F} font-weight="600" font-size="28" fill="${fill}" opacity="0.8">@alleenergia</text>`;
const foot = (fill: string, y = 1190) => t(["*Até 15% de desconto na fatura de energia, sujeito à análise", "da fatura e às condições do benefício."], 80, y, 22, 30, 400, fill, 'opacity="0.8"');
const bgRoxo = `<rect width="${W}" height="${H}" fill="${ROXO}"/><image href="alle:raio-mono" x="560" y="140" width="640" height="1021" opacity="0.09"/>`;
const bgLaranja = `<rect width="${W}" height="${H}" fill="${LAR}"/><image href="alle:raio-mono" x="560" y="140" width="640" height="1021" opacity="0.14"/>`;
const paper = `<defs><filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0 0.15  0 0 0 0.05 0"/></filter></defs>`;
const bgClaro = `${paper}<rect width="${W}" height="${H}" fill="${CLARO}"/><rect width="${W}" height="${H}" filter="url(#paper)"/>`;
const logo = (v: "logo" | "logo-branco" | "logo-mono" = "logo-branco", x = 80, y = 90, w = 320) => `<image href="alle:${v}" x="${x}" y="${y}" width="${w}" height="${(w * 353) / 1200}"/>`;
const raio = (v: "raio" | "raio-branco" | "raio-mono" = "raio-branco") => `<image href="alle:${v}" x="80" y="90" width="40" height="64"/>`;
const photo = (url: string, x: number, y: number, w: number, h: number, clip = "") =>
  `<image href="${url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" ${clip ? `clip-path="url(#${clip})"` : ""}/>`;
const stroke = (c: string, w = 7) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const check = (cx: number, cy: number, r = 26) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${VERDE}"/><path d="M${cx - 12},${cy} L${cx - 3},${cy + 9} L${cx + 13},${cy - 9}" ${stroke("#FFF", 6)}/>`;
const cross = (cx: number, cy: number, r = 26) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${VERM}"/><path d="M${cx - 9},${cy - 9} L${cx + 9},${cy + 9} M${cx + 9},${cy - 9} L${cx - 9},${cy + 9}" ${stroke("#FFF", 6)}/>`;

// Ícones de linha centrados em (0,0), cerca de 120 px.
const ICON = {
  ar: `<rect x="-60" y="-34" width="120" height="44" rx="10"/><path d="M-44,-12 H44"/><path d="M-30,26 q8,10 0,20 q-8,10 0,20 M0,26 q8,10 0,20 q-8,10 0,20 M30,26 q8,10 0,20 q-8,10 0,20"/>`,
  chuveiro: `<path d="M-40,-50 H10 q20,0 20,20 V-14"/><path d="M0,-14 H60 L48,6 H12 Z"/><path d="M18,22 v14 M30,22 v20 M42,22 v14"/>`,
  geladeira: `<rect x="-34" y="-58" width="68" height="116" rx="10"/><path d="M-34,-12 H34 M-20,-40 v14 M-20,4 v20"/>`,
  ferro: `<path d="M-56,30 H56 Q56,-20 10,-30 H-20 Q-50,-20 -56,30 Z"/><path d="M-10,-30 V-46 H30"/>`,
  maquina: `<rect x="-46" y="-56" width="92" height="112" rx="10"/><circle cx="0" cy="10" r="28"/><path d="M-30,-38 h20"/>`,
  tv: `<rect x="-56" y="-42" width="112" height="72" rx="8"/><path d="M-20,46 H20 M0,30 v16"/>`,
  conta: `<rect x="-36" y="-50" width="72" height="100" rx="8"/><path d="M-20,-26 H20 M-20,-8 H8 M-20,10 H14"/><path d="M-20,30 H20" stroke-dasharray="6 8"/>`,
  usina: `<path d="M-60,30 L-36,-30 H44 L60,30 Z"/><path d="M-50,0 H52 M-12,-30 L-20,30 M18,-30 L22,30"/><path d="M0,30 v26 M-20,56 h40"/>`,
  torre: `<path d="M0,-60 L-34,56 M0,-60 L34,56 M-22,0 H22 M-14,-30 H14 M-28,30 H28 M-22,0 L28,30 M22,0 L-28,30"/>`,
  casa: `<path d="M-56,0 L0,-50 L56,0"/><path d="M-40,-12 V50 H40 V-12"/><text x="0" y="36" text-anchor="middle" ${F} font-weight="900" font-size="48" stroke="none" fill="currentColor">$</text>`,
  credito: `<circle cx="0" cy="0" r="50"/><path d="M-6,-30 L-22,6 H4 L-4,32 L22,-6 H-4 Z"/>`,
  lupa: `<circle cx="-8" cy="-8" r="26"/><path d="M12,12 L34,34"/>`,
  celular: `<rect x="-32" y="-56" width="64" height="112" rx="12"/><path d="M0,26 V-16 M-14,-2 L0,-16 L14,-2"/>`,
};
const icon = (name: keyof typeof ICON, x: number, y: number, color: string, scale = 1, w = 7) =>
  `<g transform="translate(${x} ${y}) scale(${scale})" ${stroke(color, w)} color="${color}">${ICON[name]}</g>`;

// ─── Fotos (Pexels, via search_photos) ───────────────────────────────────────

async function photoUrl(query: string, orientation: "portrait" | "landscape" | "square" = "portrait", pick = 0) {
  const r = await searchStockPhotos(query, orientation, 4);
  if (!r.length) throw new Error(`Sem foto para "${query}"`);
  return r[Math.min(pick, r.length - 1)].url;
}

// ─── Modelos ──────────────────────────────────────────────────────────────────

type Builder = () => Promise<string> | string;

const MODELS: Record<string, Builder> = {
  M01: () => `${bgRoxo}${logo()}
${t(["A sua conta de luz"], 80, 470, 52, 0, 300, "#FFF")}
${t(["pode vir com"], 80, 535, 52, 0, 300, "#FFF")}
${t(["até"], 80, 690, 80, 0, 300, LAR_TXT)}
<text x="64" y="960" ${F} font-weight="900" font-size="330" fill="${LAR_TXT}" letter-spacing="-12">15%</text>
${t(["de desconto, todo mês.*"], 80, 1060, 52, 0, 800, "#FFF")}
${foot("#FFF", 1160)}${handle("#FFF")}`,

  M02: () => `${bgClaro}${raio("raio")}
<circle cx="250" cy="420" r="150" fill="#FFF" stroke="${LAR_TXT}" stroke-width="6"/>${icon("ar", 250, 410, LAR_TXT, 1.5, 6)}
${chip("DICA DE VERÃO", 80, 640, 300, ROXO_TXT, "#FFF")}
${t(["Ar-condicionado:"], 80, 790, 72, 0, 300, ESCURO)}
${t(["use com estratégia."], 80, 880, 78, 0, 900, ROXO_TXT)}
${t(["Feche portas e janelas para o ar", "gelado não escapar. A conta agradece."], 80, 990, 38, 54, 600, LAR_TXT)}
${handle(ESCURO)}`,

  M03: () => `${bgRoxo}${raio()}
${chip("MITO OU VERDADE?", 80, 250, 360, LAR_TXT, ESCURO)}
${t(["3 coisas que te"], 80, 420, 72, 0, 300, "#FFF")}
${t(["contaram errado."], 80, 510, 80, 0, 900, LAR_TXT)}
${[["Preciso instalar placa no telhado", false], ["Tenho fidelidade de 12 meses", false], ["Continuo com a mesma distribuidora", true]].map(([s, ok], i) => {
    const y = 620 + i * 150;
    return `<rect x="80" y="${y}" width="920" height="110" rx="55" fill="#FFF"/>
<text x="130" y="${y + 68}" ${F} font-weight="700" font-size="34" fill="${ESCURO}">${s}</text>${ok ? check(935, y + 55, 34) : cross(935, y + 55, 34)}`;
  }).join("")}
${handle("#FFF")}`,




  M08: () => `${bgClaro}${raio("raio")}
${t(["Entenda a sua"], 80, 250, 64, 0, 300, ESCURO)}${t(["conta de luz."], 80, 330, 72, 0, 900, ROXO_TXT)}
<g transform="translate(110 420) rotate(-4)">
  <rect width="420" height="640" rx="16" fill="#FFF" stroke="#DDD" stroke-width="3"/>
  <rect x="30" y="30" width="200" height="26" rx="6" fill="#CFC6D6"/><rect x="30" y="70" width="320" height="14" rx="7" fill="#E6E0EA"/>
  <rect x="30" y="140" width="360" height="90" rx="10" fill="#F3EEF6"/><text x="50" y="200" ${F} font-weight="800" font-size="40" fill="${ESCURO}">250 kWh</text>
  <rect x="30" y="260" width="360" height="60" rx="10" fill="#E9F7EF"/><text x="50" y="300" ${F} font-weight="700" font-size="26" fill="#1E7A47">Bandeira verde</text>
  <rect x="30" y="350" width="360" height="14" rx="7" fill="#E6E0EA"/><rect x="30" y="380" width="300" height="14" rx="7" fill="#E6E0EA"/><rect x="30" y="410" width="330" height="14" rx="7" fill="#E6E0EA"/>
  <rect x="30" y="470" width="360" height="70" rx="10" fill="#FFF1E6"/><text x="50" y="517" ${F} font-weight="800" font-size="32" fill="${LAR_TXT}">− Desconto</text>
  <rect x="30" y="570" width="200" height="40" rx="8" fill="#CFC6D6"/>
</g>
${[["Seu consumo", "em kWh", 560], ["A bandeira", "do mês", 700], ["Impostos", "e taxas", 830], ["Aqui entra o", "desconto da Alle", 960]].map(([a, b, y], i) =>
    `<path d="M${470 - i * 6},${Number(y) - 20 + (i === 3 ? 40 : 0)} H620" ${stroke(i === 3 ? LAR_TXT : ROXO_TXT, 4)}/><circle cx="${470 - i * 6}" cy="${Number(y) - 20 + (i === 3 ? 40 : 0)}" r="9" fill="${i === 3 ? LAR_TXT : ROXO_TXT}"/>
<rect x="620" y="${Number(y) - 70}" width="380" height="104" rx="18" fill="${i === 3 ? LAR_TXT : ROXO_TXT}"/>
${t([String(a), String(b)], 650, Number(y) - 28, 30, 38, 700, "#FFF")}`).join("")}
${handle(ESCURO)}`,

  M09: () => `${bgRoxo}${raio()}
${t(["Como o desconto"], 80, 260, 66, 0, 300, "#FFF")}${t(["chega até você."], 80, 345, 74, 0, 900, LAR_TXT)}
<path d="M200,520 V1100" stroke="#FFF" stroke-opacity="0.35" stroke-width="5" stroke-dasharray="4 16" stroke-linecap="round"/>
${[["usina", "A usina gera energia limpa"], ["torre", "Ela entra na rede da distribuidora"], ["credito", "Viram créditos de energia"], ["casa", "E abatem na sua conta de luz"]].map(([ic, s], i) => {
    const y = 520 + i * 190;
    return `<circle cx="200" cy="${y}" r="74" fill="#FFF"/>${icon(ic as keyof typeof ICON, 200, y, ROXO_TXT, 0.85, 8)}
<circle cx="262" cy="${y - 52}" r="24" fill="${LAR_TXT}"/><text x="262" y="${y - 42}" text-anchor="middle" ${F} font-weight="900" font-size="28" fill="${ESCURO}">${i + 1}</text>
<text x="320" y="${y + 14}" ${F} font-weight="700" font-size="40" fill="#FFF">${s}</text>`;
  }).join("")}
${handle("#FFF")}`,

  M10: () => `${bgRoxo}${raio()}
${t(["Quanto você pode"], 80, 250, 66, 0, 300, "#FFF")}${t(["economizar?"], 80, 335, 80, 0, 900, LAR_TXT)}
<rect x="80" y="420" width="920" height="640" rx="36" fill="#FFF"/>
${t(["Sua conta de luz"], 130, 500, 32, 0, 500, ESCURO)}${t(["R$ 300 por mês"], 130, 570, 56, 0, 900, ROXO_TXT)}
<path d="M130,620 H950" stroke="#EEE" stroke-width="3"/>
${[["por mês", "até R$ 45", 150], ["em 1 ano", "até R$ 540", 260], ["em 5 anos", "até R$ 2.700", 380]].map(([a, b, h], i) =>
    `<rect x="${150 + i * 290}" y="${1010 - Number(h)}" width="220" height="${h}" rx="18" fill="${i === 2 ? LAR_TXT : LIL}"/>
<text x="${260 + i * 290}" y="${1010 - Number(h) - 60}" text-anchor="middle" ${F} font-weight="900" font-size="38" fill="${i === 2 ? LAR_TXT : ROXO_TXT}">${b}</text>
<text x="${260 + i * 290}" y="${1010 - Number(h) - 22}" text-anchor="middle" ${F} font-weight="500" font-size="26" fill="${ESCURO}">${a}</text>`).join("")}
${t(["Valores ilustrativos: simulação com o desconto máximo de 15%.", "A economia real depende da sua conta."], 80, 1120, 24, 32, 400, "#FFF", 'opacity="0.85"')}
${handle("#FFF")}`,

  M11: () => `${bgClaro}${raio("raio")}
${t(["Onde a conta"], 80, 250, 66, 0, 300, ESCURO)}${t(["pesa mais?"], 80, 335, 80, 0, 900, ROXO_TXT)}
<path d="M440,418 L602,436 L620,508 L728,544 L836,571 L890,598 L890,670 L818,742 L818,832 L782,904 L710,931 L656,976 L647,1021 L620,1048 L566,1115 L494,1048 L548,994 L548,958 L476,904 L476,814 L440,796 L440,751 L350,724 L332,688 L260,706 L206,670 L188,634 L260,580 L260,544 L278,490 L314,472 L368,436 Z" fill="${LIL}" stroke="${ROXO_TXT}" stroke-opacity="0.25" stroke-width="4" stroke-linejoin="round"/>
<path d="M566,913 L620,868 L665,868 L683,904 L719,922 L683,944 L656,962 L620,940 L584,926 Z" fill="${LAR_TXT}" stroke="#FFF" stroke-width="3" stroke-linejoin="round"/>
<path d="M660,950 L760,1110" ${stroke(LAR_TXT, 4)}/>
<rect x="700" y="1110" width="300" height="90" rx="45" fill="${LAR_TXT}"/>${t(["São Paulo"], 745, 1168, 38, 0, 800, "#FFF")}
${handle(ESCURO)}`,

  M12: () => `${bgClaro}${raio("raio")}
${t(["A conta de sempre"], 80, 250, 62, 0, 300, ESCURO)}${t(["× a conta com a Alle"], 80, 330, 66, 0, 900, ROXO_TXT)}
<rect x="80" y="420" width="440" height="700" rx="32" fill="#EDE8EF"/><rect x="560" y="420" width="440" height="700" rx="32" fill="${ROXO_TXT}"/>
${t(["Sem a Alle"], 120, 500, 40, 0, 800, "#7A6F80")}${t(["Com a Alle"], 600, 500, 40, 0, 800, "#FFF")}
${[["Tarifa cheia", "Até 15%* off"], ["Obra no telhado", "Sem obra"], ["Fidelidade", "Sem fidelidade"], ["Papelada", "100% digital"]].map(([a, b], i) => {
    const y = 600 + i * 130;
    return `${cross(140, y, 22)}<text x="180" y="${y + 12}" ${F} font-weight="600" font-size="32" fill="#7A6F80">${a}</text>
${check(620, y, 22)}<text x="660" y="${y + 12}" ${F} font-weight="800" font-size="32" fill="#FFF">${b}</text>`;
  }).join("")}
${foot(ESCURO, 1185)}`,

  M13: () => `<rect width="${W}" height="${H}" fill="#FFFFFF"/>
<text x="70" y="120" ${F} font-weight="500" font-size="34" fill="${LAR_TXT}">‹ Notas</text>
<circle cx="990" cy="108" r="24" fill="none" stroke="${LAR_TXT}" stroke-width="4"/><text x="990" y="117" text-anchor="middle" ${F} font-weight="900" font-size="26" fill="${LAR_TXT}">···</text>
${t(["Antes de aderir,"], 80, 270, 62, 0, 800, ESCURO)}${t(["tenha em mãos:"], 80, 345, 62, 0, 800, ESCURO)}
${["A última conta de luz", "em PDF ou foto", "O nome do titular da conta", "Um e-mail que você usa", "O celular para falar com a Ane"].map((s, i) => {
    const y = 470 + i * 110;
    return `<image href="alle:raio" x="80" y="${y - 40}" width="30" height="48"/><text x="135" y="${y}" ${F} font-weight="500" font-size="40" fill="${ESCURO}">${s}</text>`;
  }).join("")}
<text x="80" y="1260" ${F} font-weight="500" font-size="28" fill="#999">1/2</text>
<path d="M985,1235 l14,14 l-14,14" ${stroke(LAR_TXT, 5)}/>`,


  M15: async () => `${bgClaro}
<defs><clipPath id="c"><circle cx="1010" cy="780" r="470"/></clipPath></defs>
${photo(await photoUrl("smiling woman using phone sofa"), 540, 310, 940, 940, "c")}
<circle cx="1010" cy="780" r="470" fill="none" stroke="${LAR_TXT}" stroke-width="10"/>
${logo("logo", 80, 90, 300)}
<path d="M60,330 V700 H480" ${stroke(LAR_TXT, 6)}/>
${t(["Conta mais", "leve, sem", "sair de casa."], 100, 420, 56, 68, 800, ROXO_TXT)}
${chip("100% DIGITAL", 100, 760, 290, LAR_TXT, "#FFF")}
${handle(ESCURO)}`,


  M17: () => `<rect width="${W}" height="${H}" fill="#FFD9BF"/>
${t(["Se outubro"], 80, 480, 84, 0, 500, ESCURO)}${t(["fosse uma cor,"], 80, 580, 84, 0, 500, ESCURO)}
${t(["seria verde."], 80, 760, 120, 0, 900, LAR_TXT)}
${t(["Bandeira verde: sem taxa extra na conta."], 80, 870, 36, 0, 600, ROXO_TXT)}
${logo("logo", 80, 1150, 280)}`,

  M18: async () => `${bgLaranja}${raio("raio-mono")}
<rect x="80" y="220" width="920" height="1000" rx="40" fill="#FFF"/>
<rect x="130" y="270" width="250" height="76" rx="38" fill="${LAR_TXT}"/><circle cx="342" cy="308" r="28" fill="#FFF"/><text x="160" y="320" ${F} font-weight="800" font-size="32" fill="#FFF">PRÓS</text>
<rect x="410" y="270" width="290" height="76" rx="38" fill="#E7E2EA"/><circle cx="448" cy="308" r="28" fill="#FFF"/><text x="490" y="320" ${F} font-weight="800" font-size="32" fill="#9A90A0">CONTRAS</text>
${t(["Energia por assinatura:"], 130, 450, 44, 0, 800, ROXO_TXT)}
${t(["sem obra no telhado."], 130, 510, 44, 0, 800, LAR_TXT)}
${t(["A energia vem de usinas parceiras e o", "desconto chega direto na sua conta."], 130, 590, 32, 44, 500, ESCURO)}
<defs><clipPath id="r"><rect x="130" y="700" width="820" height="460" rx="28"/></clipPath></defs>
${photo(await photoUrl("solar farm sunset", "landscape"), 130, 700, 820, 460, "r")}`,

  M19: () => `${bgClaro}${raio("raio")}
<rect x="80" y="380" width="920" height="120" rx="60" fill="#FFF" stroke="#DDD" stroke-width="3"/>
${icon("lupa", 160, 440, "#999", 1, 6)}
<text x="220" y="458" ${F} font-weight="500" font-size="44" fill="${ESCURO}">placa solar</text><rect x="470" y="410" width="4" height="60" fill="${LAR_TXT}"/>
${t(["Você quis dizer:"], 80, 700, 52, 0, 300, ESCURO, 'font-style="italic"')}
${t(["desconto na conta", "sem obra nenhuma."], 80, 810, 84, 98, 900, ROXO_TXT)}
${t(["Com a Alle, até 15%* de desconto sem", "instalar nada no telhado."], 80, 1040, 36, 50, 600, LAR_TXT)}
${foot(ESCURO)}`,

  M20: () => `${bgRoxo}${raio()}
${t(["5 aparelhos que"], 80, 250, 66, 0, 300, "#FFF")}${t(["mais pesam na conta"], 80, 335, 70, 0, 900, LAR_TXT)}
${[["chuveiro", "Chuveiro"], ["ar", "Ar-condicionado"], ["geladeira", "Geladeira"], ["ferro", "Ferro de passar"], ["maquina", "Máquina de lavar"], ["tv", "E a TV ligada?"]].map(([ic, s], i) => {
    const x = 80 + (i % 2) * 470, y = 430 + Math.floor(i / 2) * 260, dark = (i + Math.floor(i / 2)) % 2 === 1;
    return `<rect x="${x}" y="${y}" width="450" height="236" rx="28" fill="${dark ? ROXO_ESC : "#FFF"}"/>
${icon(ic as keyof typeof ICON, x + 110, y + 118, dark ? LAR_TXT : ROXO_TXT, 0.9, 7)}
<text x="${x + 200}" y="${y + 130}" ${F} font-weight="800" font-size="30" fill="${dark ? "#FFF" : ESCURO}">${s}</text>`;
  }).join("")}
${handle("#FFF")}`,

  M21: () => `<rect width="${W}" height="${H}" fill="${ROXO_ESC}"/>
<circle cx="1080" cy="760" r="430" fill="${LAR_TXT}"/>
<g transform="translate(840 760) rotate(8)"><rect x="-150" y="-290" width="300" height="580" rx="44" fill="#1B1B1F"/><rect x="-130" y="-268" width="260" height="536" rx="30" fill="#FFF"/>
<rect x="-100" y="-200" width="200" height="40" rx="10" fill="#F3EEF6"/><rect x="-100" y="-140" width="140" height="20" rx="10" fill="#E6E0EA"/>
<rect x="-100" y="-80" width="200" height="200" rx="16" fill="${LIL}"/>${icon("conta", 0, 20, ROXO_TXT, 1.2, 7)}
<rect x="-100" y="160" width="200" height="60" rx="30" fill="${LAR_TXT}"/><text x="0" y="200" text-anchor="middle" ${F} font-weight="800" font-size="26" fill="#FFF">Enviar</text></g>
${raio()}
${chip("PASSO 2 DE 4", 80, 300, 300, LAR_TXT, ESCURO)}
${t(["Envie a"], 80, 470, 80, 0, 300, "#FFF")}${t(["sua fatura."], 80, 565, 84, 0, 900, LAR_TXT)}
${t(["Em PDF ou foto,", "pelo WhatsApp mesmo."], 80, 680, 38, 54, 500, "#FFF")}
${handle("#FFF")}`,


  M23: () => `${bgRoxo}${raio()}
${t(["Quanto a bandeira"], 80, 250, 62, 0, 300, "#FFF")}${t(["soma na conta"], 80, 330, 72, 0, 900, LAR_TXT)}
${t(["a cada 100 kWh consumidos"], 80, 390, 34, 0, 500, "#FFF", 'opacity="0.85"')}
${[["Verde", "R$ 0", 40, "#22B35E"], ["Amarela", "+R$ 1,885", 230, "#F2C200"], ["Vermelha 1", "+R$ 4,463", 470, "#E2402B"], ["Vermelha 2", "+R$ 7,877", 640, "#A3172A"]].map(([a, b, h, c], i) => {
    const x = 90 + i * 235, base = 1130;
    return `<rect x="${x}" y="${base - Number(h)}" width="190" height="${h}" rx="18" fill="${c}"/>
<text x="${x + 95}" y="${base - Number(h) - 24}" text-anchor="middle" ${F} font-weight="900" font-size="34" fill="#FFF">${b}</text>
<text x="${x + 95}" y="${base + 50}" text-anchor="middle" ${F} font-weight="700" font-size="28" fill="#FFF">${a}</text>`;
  }).join("")}
${t(["Fonte: ANEEL"], 80, 1270, 24, 0, 400, "#FFF", 'opacity="0.8"')}`,



  M26: () => `${bgClaro}${raio("raio")}
${t(["Escolha 1 letra"], 80, 260, 70, 0, 300, ESCURO)}${t(["e 1 número."], 80, 345, 78, 0, 900, ROXO_TXT)}
${["A", "B", "C", "D"].map((l, i) => `<rect x="${80 + i * 235}" y="420" width="210" height="300" rx="26" fill="${ROXO_TXT}"/><circle cx="${185 + i * 235}" cy="500" r="40" fill="#FFF"/><text x="${185 + i * 235}" y="516" text-anchor="middle" ${F} font-weight="900" font-size="44" fill="${ROXO_TXT}">${l}</text><text x="${185 + i * 235}" y="660" text-anchor="middle" ${F} font-weight="900" font-size="90" fill="#FFF" opacity="0.3">?</text>`).join("")}
${["1", "2", "3", "4"].map((n, i) => `<rect x="${80 + i * 235}" y="750" width="210" height="300" rx="26" fill="${LAR_TXT}"/><circle cx="${185 + i * 235}" cy="830" r="40" fill="#FFF"/><text x="${185 + i * 235}" y="846" text-anchor="middle" ${F} font-weight="900" font-size="44" fill="${LAR_TXT}">${n}</text><text x="${185 + i * 235}" y="990" text-anchor="middle" ${F} font-weight="900" font-size="90" fill="#FFF" opacity="0.35">?</text>`).join("")}
${t(["e descubra o seu benefício com a Alle →"], 80, 1130, 36, 0, 700, LAR_TXT)}
${handle(ESCURO)}`,

  M27: async () => `${photo(await photoUrl("power lines blue sky", "portrait", 1), 0, 0, W, 820)}
<rect y="780" width="${W}" height="570" fill="#FFF"/>
<defs><linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="${ROXO_TXT}"/><stop offset="1" stop-color="${LAR_TXT}"/></linearGradient></defs>
<rect y="1338" width="${W}" height="12" fill="url(#b)"/>
${chip("BANDEIRA", 80, 740, 240, LAR_TXT, "#FFF")}
${t(["Outubro tem bandeira", "verde: sem taxa extra", "na conta de luz."], 80, 900, 64, 76, 800, ROXO_TXT)}
${t(["Fonte: ANEEL · @alleenergia"], 80, 1270, 26, 0, 500, ESCURO, 'opacity="0.7"')}
<image href="alle:raio" x="960" y="1190" width="50" height="80"/>`,

  M28: () => `${paper}<rect width="${W}" height="${H}" fill="${ROXO}"/><rect width="${W}" height="${H}" filter="url(#paper)" opacity="0.8"/>
${[[-6, 120, 260, "Conta de luz pesa mais", "no orçamento das famílias"], [4, 160, 520, "Brasileiros têm dificuldade", "para entender a conta de luz"], [-3, 110, 780, "Bandeira tarifária muda", "o valor da conta todo mês"]].map(([r, x, y, a, b]) =>
    `<g transform="rotate(${r} 540 ${Number(y) + 90})"><rect x="${x}" y="${y}" width="820" height="190" fill="#FFF"/><rect x="${Number(x) + 30}" y="${Number(y) + 24}" width="140" height="12" fill="#CCC"/>
${t([String(a), String(b)], Number(x) + 30, Number(y) + 92, 40, 50, 800, "#222")}<rect x="${Number(x) + 30}" y="${Number(y) + 160}" width="500" height="10" fill="#E2E2E2"/></g>`).join("")}
<rect x="60" y="1040" width="960" height="190" rx="30" fill="${LAR_TXT}"/>
${t(["Todo mundo reclama da conta."], 100, 1118, 46, 0, 800, ESCURO)}${t(["A gente resolve."], 100, 1185, 54, 0, 900, "#FFF")}`,



  M31: async () => `${bgClaro}${raio("raio")}
${t(["A conta de luz pode"], 540, 260, 58, 0, 600, ROXO_TXT, 'text-anchor="middle"')}${t(["ficar mais cara."], 540, 332, 58, 0, 600, ROXO_TXT, 'text-anchor="middle"')}
${t(["Mas a sua economia"], 540, 425, 66, 0, 900, ROXO_TXT, 'text-anchor="middle"')}<text x="540" y="505" text-anchor="middle" ${F} font-size="66" font-weight="900" fill="${ROXO_TXT}">pode contar com a <tspan fill="${LAR_TXT}">Alle!</tspan></text>
${chip("ATIVE AGORA", 380, 550, 320, LAR_TXT, "#FFF")}
<rect x="190" y="680" width="700" height="440" rx="24" fill="#2B2233"/><rect x="215" y="705" width="650" height="390" rx="8" fill="#FFF"/>
<rect x="215" y="705" width="650" height="44" fill="${LIL}"/>${t(["NOTÍCIAS · ECONOMIA"], 240, 735, 20, 0, 800, ROXO_TXT, 'letter-spacing="2"')}
${t(["Conta de luz deve ficar mais", "cara em dezembro; veja", "o que muda na sua fatura"], 240, 800, 32, 42, 800, ESCURO)}
${photo(await photoUrl("electricity bill paper calculator", "landscape"), 240, 940, 600, 140)}
<path d="M120,1120 H960 L1000,1160 H80 Z" fill="#CFC6D6"/>
${logo("logo", 400, 1200, 280)}`,

  M32: async () => `${photo(await photoUrl("solar panels sunset", "portrait"), 0, 0, W, H)}<rect width="${W}" height="${H}" fill="#1A0026" opacity="0.62"/>
<path d="M1080,160 H130 Q100,160 100,190 V960" fill="none" stroke="#FFF" stroke-width="4" stroke-linecap="round"/>
<path d="M0,1040 H880 Q910,1040 910,1070 V1260" fill="none" stroke="#FFF" stroke-width="4" stroke-linecap="round"/>
${t(["NÃO SÓ UM DESCONTO, MAS"], 160, 320, 50, 0, 300, "#FFF")}${t(["UM COMPROMISSO", "COM VOCÊ."], 160, 400, 70, 80, 900, LAR_TXT)}
<text ${F} font-size="32" font-weight="400" fill="#FFF"><tspan x="160" y="1110">Atendimento com <tspan fill="${LAR_TXT}" font-weight="700">clareza</tspan>, sem obra</tspan><tspan x="160" dy="44">e sem fidelidade, do primeiro</tspan><tspan x="160" dy="44">ao último contato.</tspan></text>
${logo("logo-branco", 100, 50, 260)}`,

  M33: async () => `${bgClaro}
<g transform="translate(483 71) scale(0.62)"><path d="M440,418 L602,436 L620,508 L728,544 L836,571 L890,598 L890,670 L818,742 L818,832 L782,904 L710,931 L656,976 L647,1021 L620,1048 L566,1115 L494,1048 L548,994 L548,958 L476,904 L476,814 L440,796 L440,751 L350,724 L332,688 L260,706 L206,670 L188,634 L260,580 L260,544 L278,490 L314,472 L368,436 Z" fill="${LIL}" stroke="${ROXO_TXT}" stroke-opacity="0.25" stroke-width="4" stroke-linejoin="round"/>
<path d="M566,913 L620,868 L665,868 L683,904 L719,922 L683,944 L656,962 L620,940 L584,926 Z" fill="${LAR_TXT}"/></g>
<rect x="70" y="300" width="560" height="440" rx="40" fill="${ROXO}"/>
${t(["+X"], 110, 520, 220, 0, 900, "#FFF")}${t(["mil clientes", "atendidos"], 110, 610, 56, 62, 800, LAR_TXT)}
<rect y="820" width="${W}" height="530" fill="${ROXO_ESC}"/>
${t(["Milhares de clientes."], 80, 930, 44, 0, 500, "#FFF")}${t(["Uma economia real."], 80, 990, 48, 0, 900, "#FFF")}
${logo("logo-branco", 80, 1160, 300)}
<image href="alle:ane-sorrindo" x="${1080 - 560}" y="${1350 - 640}" width="560" height="644"/>`,
  M34: () => {
    const tape = (y: number, rot: number, fill: string) => `<g transform="translate(540 ${y}) rotate(${rot})"><rect x="-900" y="-36" width="1800" height="72" fill="${fill}"/>${t([Array(8).fill("BLACK FRIDAY DA ALLE ·").join(" ")], -880, 14, 30, 0, 800, "#FFF", 'letter-spacing="2"')}</g>`;
    return `<rect width="${W}" height="${H}" fill="#0B0710"/><radialGradient id="g34" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="${ROXO}" stop-opacity="0.45"/><stop offset="1" stop-color="${ROXO}" stop-opacity="0"/></radialGradient><rect width="${W}" height="${H}" fill="url(#g34)"/>
${tape(150, -12, LAR_TXT)}${tape(230, 8, ROXO)}${tape(1250, -6, LAR_TXT)}
<g transform="translate(560 520) rotate(-8)"><path d="M-330,-130 H260 L330,-60 V60 L260,130 H-330 Z" fill="${LAR_TXT}"/><circle cx="262" cy="0" r="20" fill="#0B0710"/>${t(["Black"], -290, 60, 170, 0, 900, "#FFF")}</g>
<g transform="translate(540 700) rotate(-2)"><rect x="-320" y="-70" width="640" height="130" rx="14" fill="none" stroke="#FFF" stroke-width="5"/>${t(["FRIDAY"], 0, 40, 110, 0, 900, "#FFF", 'text-anchor="middle" letter-spacing="6"')}</g>
${t(["O desconto que volta todo mês."], 540, 860, 44, 0, 600, "#FFF", 'text-anchor="middle"')}
<rect x="170" y="920" width="350" height="140" rx="20" fill="${LAR_TXT}"/>${t(["TODO", "MÊS"], 345, 980, 44, 48, 900, "#FFF", 'text-anchor="middle"')}
<rect x="560" y="920" width="350" height="140" rx="20" fill="${LAR_TXT}"/>${t(["SEM", "FIDELIDADE"], 735, 980, 44, 48, 900, "#FFF", 'text-anchor="middle"')}
${logo("logo-branco", 400, 1100, 280)}`;
  },

  M35: () => `<rect width="${W}" height="${H}" fill="#0B0710"/><image href="alle:raio-mono" x="560" y="200" width="600" height="957" opacity="0.07"/>
${t(["Black Friday da Alle:"], 80, 230, 56, 0, 300, "#FFF")}${t(["o cupom que não vence."], 80, 310, 64, 0, 900, LAR_TXT)}
<g transform="translate(540 680) rotate(-8)">
<path d="M-420,-200 H420 V-40 A40,40 0 0 0 420,40 V200 H-420 V40 A40,40 0 0 0 -420,-40 Z" fill="#FFF"/>
<rect x="-420" y="-200" width="190" height="400" fill="${LAR_TXT}"/><path d="M-230,-200 V200" stroke="#0B0710" stroke-width="5" stroke-dasharray="14 12"/>
<g transform="translate(-325 0) rotate(-90)">${t(["CUPOM"], 0, 22, 64, 0, 900, "#FFF", 'text-anchor="middle" letter-spacing="8"')}</g>
${t(["BLACK FRIDAY DA ALLE"], -180, -90, 34, 0, 800, ROXO_TXT, 'letter-spacing="2"')}${t(["DESCONTO", "TODO MÊS"], -180, 10, 84, 86, 900, "#0B0710")}</g>
<rect x="330" y="1030" width="420" height="96" rx="12" fill="none" stroke="#FFF" stroke-width="4"/>${t(["CHAME A ANE"], 540, 1092, 40, 0, 900, "#FFF", 'text-anchor="middle" letter-spacing="3"')}
${logo("logo-branco", 400, 1180, 280)}`,

  M36: () => `<rect width="${W}" height="${H}" fill="#0B0710"/><radialGradient id="g36" cx="0.5" cy="0.45" r="0.55"><stop offset="0" stop-color="${ROXO}" stop-opacity="0.6"/><stop offset="1" stop-color="${ROXO}" stop-opacity="0"/></radialGradient><rect width="${W}" height="${H}" fill="url(#g36)"/>
<linearGradient id="neon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${LAR_TXT}"/><stop offset="1" stop-color="#FFD27A"/></linearGradient><filter id="glow36"><feGaussianBlur stdDeviation="14"/></filter>
${t(["A ECONOMIA QUE VALE O MÊS INTEIRO"], 540, 150, 34, 0, 800, "#FFF", 'text-anchor="middle" letter-spacing="2"')}
${t(["BLACK"], 540, 300, 170, 0, 900, "#FFF", 'text-anchor="middle"')}
<g filter="url(#glow36)" opacity="0.8">${t(["FRIDAY"], 540, 460, 170, 0, 900, LAR_TXT, 'text-anchor="middle"')}</g>${t(["FRIDAY"], 540, 460, 170, 0, 900, "url(#neon)", 'text-anchor="middle"')}
<g filter="url(#glow36)" opacity="0.5"><ellipse cx="540" cy="900" rx="330" ry="40" fill="#000"/></g>
<g transform="translate(330 560) rotate(-6)"><rect width="300" height="380" rx="16" fill="#FFF"/>${t(["CONTA DE LUZ"], 30, 60, 28, 0, 800, ROXO_TXT)}<path d="M30,100 H260 M30,140 H220 M30,180 H250 M30,220 H200" stroke="#D9CCE6" stroke-width="10"/><rect x="30" y="270" width="240" height="70" rx="10" fill="${LAR_TXT}"/>${t(["ATÉ 15% PF"], 150, 316, 28, 0, 900, "#FFF", 'text-anchor="middle"')}</g>
<g transform="translate(600 600) rotate(8)"><rect width="200" height="330" rx="30" fill="#1D1424" stroke="#FFF" stroke-width="6"/><rect x="20" y="40" width="160" height="60" rx="14" fill="${ROXO}"/>${t(["Ane"], 40, 80, 26, 0, 800, "#FFF")}<rect x="40" y="120" width="140" height="50" rx="14" fill="#FFF"/><rect x="20" y="190" width="130" height="50" rx="14" fill="${LAR_TXT}"/></g>
<circle cx="880" cy="600" r="90" fill="${LAR_TXT}"/>${t(["TODO", "MÊS"], 880, 590, 34, 38, 900, "#FFF", 'text-anchor="middle"')}
${t(["A economia da sua conta de luz"], 540, 1030, 42, 0, 400, "#FFF", 'text-anchor="middle"')}${t(["vale o mês inteiro."], 540, 1090, 48, 0, 900, "#FFF", 'text-anchor="middle"')}
${t(["CHAME A ANE NO WHATSAPP"], 540, 1170, 34, 0, 900, LAR_TXT, 'text-anchor="middle" letter-spacing="2"')}
${logo("logo-branco", 420, 1210, 240)}`,

  M37: () => `<rect width="${W}" height="${H}" fill="#0B0710"/><radialGradient id="g37" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="${ROXO}" stop-opacity="0.5"/><stop offset="1" stop-color="${ROXO}" stop-opacity="0"/></radialGradient><rect width="${W}" height="${H}" fill="url(#g37)"/>
<linearGradient id="neon37" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${LAR_TXT}"/><stop offset="1" stop-color="#FFD27A"/></linearGradient><filter id="glow37"><feGaussianBlur stdDeviation="16"/></filter>
${t(["PREPARE-SE PARA"], 540, 360, 64, 0, 800, "#FFF", 'text-anchor="middle" letter-spacing="3"')}
<g filter="url(#glow37)" opacity="0.7">${t(["ECONOMIZAR"], 540, 480, 120, 0, 900, LAR_TXT, 'text-anchor="middle"')}</g>${t(["ECONOMIZAR"], 540, 480, 120, 0, 900, "url(#neon37)", 'text-anchor="middle"')}
${t(["AINDA MAIS NA SUA"], 540, 570, 60, 0, 800, "#FFF", 'text-anchor="middle" letter-spacing="3"')}
${t(["BLACK"], 540, 740, 170, 0, 900, "#FFF", 'text-anchor="middle"')}
<g filter="url(#glow37)" opacity="0.7">${t(["FRIDAY"], 540, 900, 170, 0, 900, LAR_TXT, 'text-anchor="middle"')}</g>${t(["FRIDAY"], 540, 900, 170, 0, 900, "url(#neon37)", 'text-anchor="middle"')}
${t(["E o que a Alle tem a ver com a Black?"], 540, 1010, 40, 0, 500, "#FFF", 'text-anchor="middle"')}${t(["Dia 27/11 você descobre."], 540, 1065, 44, 0, 900, "#FFF", 'text-anchor="middle"')}
${logo("logo-branco", 400, 1170, 280)}`,
};

// M07 (linha contínua) mostra dois slides lado a lado para a linha aparecer passando.
async function buildM07() {
  const line = `fill="none" stroke="${LAR_TXT}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"`;
  const badge = (cx: number, cy: number, name: keyof typeof ICON) => `<circle cx="${cx}" cy="${cy}" r="76" fill="${CLARO}" stroke="${LAR_TXT}" stroke-width="7"/>${icon(name, cx, cy, LAR_TXT, 0.7, 9)}`;
  const s1 = `${bgClaro}${raio("raio")}
<path d="M0,1100 H860 Q900,1100 900,1060 V400 Q900,360 940,360 H1080" ${line}/>${badge(900, 730, "conta")}
${chip("PASSO 1 DE 4", 80, 300, 300, ROXO_TXT, "#FFF")}
${t(["Conte quanto"], 80, 470, 80, 0, 300, ESCURO)}${t(["paga de luz."], 80, 568, 88, 0, 900, ROXO_TXT)}
${t(["Diga o valor médio da", "sua conta e a gente", "calcula a economia."], 80, 690, 40, 56, 500, ESCURO)}`;
  const s2 = `${bgClaro}${raio("raio")}
<path d="M0,360 H140 Q180,360 180,400 V1060 Q180,1100 220,1100 H1080" ${line}/>${badge(180, 730, "celular")}
${chip("PASSO 2 DE 4", 300, 300, 300, ROXO_TXT, "#FFF")}
${t(["Envie a"], 300, 470, 80, 0, 300, ESCURO)}${t(["sua fatura."], 300, 568, 88, 0, 900, ROXO_TXT)}
${t(["Em PDF ou foto, pelo", "WhatsApp mesmo."], 300, 690, 40, 56, 500, ESCURO)}`;
  const wrap = (s: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${s}</svg>`;
  const [a, b] = await Promise.all([renderDesign(wrap(s1), "feed_4x5"), renderDesign(wrap(s2), "feed_4x5")]);
  // Prévia 4:5 com os dois slides lado a lado, encostados, para a linha aparecer contínua.
  const half = async (png: Buffer) => sharp(png).resize({ width: 540 }).toBuffer();
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
<text x="540" y="230" text-anchor="middle" font-family="Montserrat" font-weight="800" font-size="44" fill="${ROXO_TXT}">a linha passa de um slide</text>
<text x="540" y="290" text-anchor="middle" font-family="Montserrat" font-weight="800" font-size="44" fill="${ROXO_TXT}">para o outro →</text></svg>`);
  return sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#EFE6F5" } })
    .composite([{ input: label, left: 0, top: 0 }, { input: await half(a), left: 0, top: 360 }, { input: await half(b), left: 540, top: 360 }])
    .png().toBuffer();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const ids = [...Object.keys(MODELS), "M07"].filter((id) => !only.length || only.includes(id));
  for (const id of ids) {
    let png: Buffer;
    if (id === "M07") {
      png = await buildM07();
    } else {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${await MODELS[id]()}</svg>`;
      png = await renderDesign(svg, "feed_4x5");
    }
    await sharp(png).resize({ width: 540 }).webp({ quality: 82 }).toFile(path.join(OUT, `${id}.webp`));
    console.log("ok", id);
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
