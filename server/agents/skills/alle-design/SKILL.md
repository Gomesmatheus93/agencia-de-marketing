---
name: alle-design
description: >-
  Como desenhar as artes da Alle Energia (posts, slides de carrossel, stories)
  em SVG e transformá-las em PNG com a ferramenta render_design. Use sempre que
  for entregar uma peça visual.
---

# alle-design

Você não gera imagens em pixels. Você **desenha a arte em SVG** (layout,
tipografia, formas, logo e fotos de banco) e a ferramenta `render_design`
transforma em PNG, salva na galeria da plataforma e te devolve a imagem para
você conferir. A peça só está pronta depois que você olhou o PNG.

## Formatos

| formato | viewBox | uso | zona segura do texto |
| --- | --- | --- | --- |
| `feed_4x5` | `0 0 1080 1350` | post e slides de carrossel | 80 px das laterais, 100 px de cima e de baixo |
| `feed_1x1` | `0 0 1080 1080` | post quadrado | 80 px de todos os lados |
| `story_9x16` | `0 0 1080 1920` | stories e capa de reels | nada acima de y=250 nem abaixo de y=1600 |

O `<svg>` precisa ter exatamente esse `viewBox` (e `xmlns="http://www.w3.org/2000/svg"`).

## Identidade

**Cores**

| papel | cor |
| --- | --- |
| roxo Alle (principal) | `#7c00ae` |
| roxo de fundo | `#7B2FBE` |
| roxo escuro (formas, sombras) | `#5B1D9A`, `#44015e` |
| lilás claro | `#a23fd6` |
| laranja Alle (destaque) | `#ff7300` |
| laranja de fundo | `#F47B20` |
| laranjas das formas | `#F99040` (claro), `#CC5500` (escuro) |
| texto escuro sobre laranja | `#1E0A01` |
| off-white | `#FFF8F2` |

Uma cor de destaque por peça. Laranja sobre roxo ou branco sobre laranja; nunca
laranja sobre laranja nem roxo sobre roxo para texto.

**Tipografia:** só `font-family="Montserrat"`. Pesos disponíveis: 300, 400,
500, 600, 700, 800, 900. Título em dois pesos é a assinatura da Alle: a
primeira parte fina (300) em branco, a parte que importa em extra-negrito (800)
na cor de destaque.

**Tamanhos mínimos** (a peça é vista no celular a um terço do tamanho real):
título 72–110 px, texto de apoio 34–44 px, rodapé/@ 26–30 px. Nada abaixo de 26 px.

**Logo** (use como `<image href="alle:…">`, mantendo a proporção):

| href | proporção | quando |
| --- | --- | --- |
| `alle:logo` | 1200×353 | fundo claro |
| `alle:logo-branco` | 1200×353 | fundo roxo ou foto escura (o raio tem metade laranja) |
| `alle:logo-mono` | 1200×353 | logo todo branco: fundo laranja |
| `alle:raio` | 376×600 | o raio sozinho, fundo claro |
| `alle:raio-branco` | 376×600 | o raio sozinho (branco e laranja), fundo roxo ou escuro |
| `alle:raio-mono` | 376×600 | o raio sozinho, todo branco: fundo laranja e marca d'água |
| `alle:allpfit-mono` | 1271×275 | logo da Allp Fit todo branco: co-branding da parceria sobre roxo/laranja |
| `alle:allpfit-branco` | 1271×275 | logo da Allp Fit com ícone laranja e texto branco: fundo escuro |
| `alle:allpfit` | 1271×275 | logo da Allp Fit colorido: fundo claro |
| `alle:allpfit-roxo` | 1271×275 | logo roxa oficial da Allp Fit (ícone laranja, letras roxo-escuras): fundo claro, ou sobre uma pílula branca no roxo |

Logo completo com 300–380 px de largura no canto superior esquerdo da capa e
do CTA. Nos slides do meio, só o raio pequeno (40–60 px de largura) ou nada.
Em fundo laranja, o logo é **sempre** o `alle:logo-mono` e o raio é **sempre** o `alle:raio-mono` (o raio-branco tem
metade laranja e essa metade some no fundo laranja).

## A Ane nas artes (regra da equipe: sempre que couber)

A **Ane** é a atendente virtual da Alle (a mesma do WhatsApp) e é o **rosto da marca**. Sempre
que a arte tiver espaço, coloque a foto dela:

Todas são PNG recortados (fundo transparente), com a camiseta roxa com o logo da Alle e cortadas
na cintura:

| href | proporção | pose | combina com |
| --- | --- | --- | --- |
| `alle:ane` | 848×997 | braços cruzados, sorrindo | confiança, oferta, capa |
| `alle:ane-solto` | 880×994 | de frente, cabelo solto, sorrindo | convite, CTA, "fala comigo" |
| `alle:ane-caneca` | 1016×1020 | segurando a caneca da Alle | dica, conversa leve, bastidor (a caneca fica do lado esquerdo dela: deixe espaço) |
| `alle:ane-ombro` | 742×1020 | de costas, olhando por cima do ombro | "arrasta pro lado", curiosidade; use no canto direito, ela olha para o texto |

**Alterne as fotos:** não repita a mesma foto em dois posts seguidos do calendário e, num
carrossel com a Ane em 2 slides, use uma foto diferente em cada. A largura é sempre
altura × proporção da tabela (ex.: `alle:ane-ombro` com 700 de altura tem 509 de largura).

- **Onde entra:** capa e slide de CTA do carrossel, post de oferta, stories e posts que chamam
  para falar com ela ("chama a Ane", "manda a fatura pra mim"). Num carrossel, no máximo 2 slides
  (em geral capa e CTA); nos slides do meio, só se sobrar espaço de verdade.
- **Como posicionar:** sempre **encostada na borda de baixo** da arte (o corte da cintura fica
  rente ao pé da peça, nunca "flutuando"), no canto direito ou esquerdo, com 560 a 900 px de
  altura. Mantenha a proporção de cada foto (tabela acima). Ela pode passar por cima do raio de
  marca d'água e de formas decorativas, nunca por cima de texto, número, ícone ou botão: reserve
  o lado dela e quebre o texto em linhas mais curtas do outro lado. O @ e a ressalva do 35%
  ficam do lado oposto ou acima dela.
- **Combina com:** fundo roxo `#7B2FBE`, laranja ou claro. Um balão curto ao lado do rosto
  ("Fala comigo!", "Manda sua conta pra mim") reforça o CTA.
- **Quando não usar:** arte com foto de outra pessoa (cliente, aluno, equipe), tabelas e
  gráficos que ocupam a peça inteira, notícia do setor, data comemorativa sensível (luto,
  Consciência Negra) e qualquer arte em que ela teria de ficar minúscula (menos de 520 px) ou
  cobrir informação. Nesses casos, sem a Ane.
- Nunca recorte o rosto, espelhe, distorça, mude a cor da camiseta ou coloque a Ane dizendo um
  número ou depoimento: ela convida para a conversa, não dá prova.

Sem numeração nos slides: nada de contador "2/7" no topo nem número gigante
de marca d'água no fundo (pedido da equipe).

**Assinatura dos fundos** (a mesma dos templates "Alle Laranja" e "Alle Roxo"):
- Roxo: fundo `#7B2FBE` com o raio da marca grande e bem sutil atrás do texto,
  do lado direito (aprovado pela equipe; em 4:5, ajuste x/y para outros formatos):
  `<image href="alle:raio-mono" x="560" y="140" width="640" height="1021" opacity="0.09"/>`
  Nunca desenhe o raio à mão com `<polygon>`: as linhas se cruzam e fica feio.`
- Laranja: fundo `#F47B20` com o mesmo raio grande, todo branco e sutil:
  `<image href="alle:raio-mono" x="560" y="140" width="640" height="1021" opacity="0.14"/>`
- Claro: fundo `#FFF8F2`, texto `#1E0A01`, destaques em `#7c00ae` e `#ff7300`.

Alterne roxo e laranja ao longo de um carrossel (ex.: capa roxa, miolo
laranja/claro, CTA roxo) para dar ritmo sem perder a unidade.

## Texto no SVG

O SVG **não quebra linha sozinho**. Quebre você, com `<tspan x="…" dy="…">`.
Para estimar quantos caracteres cabem numa linha de Montserrat:
largura disponível ÷ (tamanho da fonte × 0,6) no peso 800, × 0,55 no 400,
× 0,52 no 300. Com 920 px de largura útil: ~15 caracteres a 100 px/800,
~19 a 80 px/800, ~40 a 40 px/400. Na dúvida, fonte menor ou menos palavras.

Entrelinha: 1,1 a 1,15× o tamanho no título; 1,35× no texto corrido.
Escape `&` como `&amp;` e `<` como `&lt;` dentro do texto.

## Fotos

Use `search_photos` para achar fotos (pessoas reais, casas, telhados com
painel solar, conta de luz, comércio, academia…). Prefira fotos verticais
para `feed_4x5` e `story_9x16`. Use a `url` grande no `<image>`, com
`preserveAspectRatio="xMidYMid slice"` e as dimensões da área. Sempre ponha
uma camada escura ou um degradê (roxo `#44015e` a 70–85% de opacidade) entre a
foto e o texto. Texto direto sobre foto sem camada é proibido.
Nunca use foto com marca, logo ou texto de terceiros em destaque.

## Layouts do carrossel

1. **Capa:** logo no topo, título em dois pesos ocupando o terço de baixo, uma
   linha de promessa, "Desliza →" e "@alleenergia" no rodapé.
2. **Conteúdo:** título de 3 a 7 palavras (700–800), até 25 palavras de apoio
   (400–500). Uma ideia por slide.
3. **Resumo:** lista curta, feita para print e para mandar a alguém.
4. **CTA:** uma ação só, em destaque; logo completo; @alleenergia.

Sem numeração: nada de `n/N` no canto nem número grande ao fundo (pedido da
equipe). Se a ordem importar (passo a passo, lista), use um selo pequeno
"PASSO 2 DE 3" ou o número dentro de um círculo ao lado do título.

## Modelos de referência (leia antes de desenhar)

Antes de desenhar qualquer post, carrossel ou capa, leia a biblioteca de modelos com
`read_file("skills/alle-design/referencias.md")`. São 30 modelos (M01–M30) estudados das
referências do setor e já adaptados à identidade Alle: número gigante, linha contínua entre slides,
documento anotado, mito ou verdade, prós e contras, simulação de economia, série emocional etc.
Escolha um modelo que combine com o objetivo do card, varie em relação à última peça e diga na
entrega qual modelo usou. Se o usuário pedir "outro modelo" ou "outra opção", escolha um modelo
diferente da tabela, não só outra cor.

## Layout da parceria com a Allp Fit (padrão da equipe)

Todo post, capa ou arte que fala da parceria Alle + Allp Fit segue o estilo do
post real em collab com a @allpfit:

- **Fundo roxo profundo** (`#5A16A8`, com uma camada `#3d0b80` a ~35%) e
  **faixas diagonais em degradê laranja** (`#ff6a00` → `#ff8a1f`, de
  transparente a ~90%): uma no canto superior direito, outra entrando pela
  esquerda na altura do terço de baixo.
- **Co-branding no topo à esquerda:** "allp fit" + "+" + `alle:logo-branco`,
  tudo branco, do mesmo tamanho visual: `alle:allpfit-mono` + "+" +
  `alle:logo-branco`.
- **Pessoa recortada (sem fundo) à direita**, ocupando da metade para baixo e
  saindo pela borda inferior, sorrindo, de preferência em roupa de treino ou
  com camisa da Alle/Allp Fit. Foto real da equipe/alunos tem prioridade; banco
  só como apoio. O recorte é PNG com transparência (não coloque caixa nem
  sombra atrás).
- **Card 1 (à esquerda, sobre a pessoa se precisar):** retângulo de cantos bem
  arredondados (rx ~34) em degradê de laranja para transparente da esquerda
  para a direita; linha de apoio em 500 (ex.: "Sua conta de luz pode") e o
  título em 900, CAIXA ALTA, 2 linhas (ex.: "CUSTAR ATÉ / 35% MENOS.*").
- **Card 2:** laranja sólido, cantos arredondados, "E O MELHOR:" em 900 e os
  benefícios em 600 (sem obras, mesma distribuidora, quem tem direito).
- **Rodapé à esquerda:** selo escuro "ENERGIA DIGITAL" com o raio, o CTA em
  800 e uma seta branca para a direita (em carrossel, ela indica deslizar).
- Ressalva do 35% sempre que o percentual aparecer, pequena, no rodapé.
- Texto nunca em cima do rosto da pessoa: mova a pessoa para a direita.

## Rotina de revisão (obrigatória)

1. Desenhe e chame `render_design`.
2. Olhe o PNG devolvido e confira: algum texto saiu da zona segura ou foi
   cortado? Alguma linha encostou na outra? O contraste está bom? O destaque
   é o que mais chama atenção? O logo está nítido e proporcional?
3. Se algo estiver errado, corrija e renderize de novo. Duas correções por
   peça é o normal; se passar de três, simplifique o layout.
4. Entregue com os links das artes, na ordem.

Nunca invente número, depoimento, cliente ou selo na arte. Se faltar um dado,
deixe a área com um texto neutro e avise na entrega.
