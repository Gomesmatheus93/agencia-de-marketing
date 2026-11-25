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

**Tipografia (padrão dos posts desde 24/11/2026, pedido da equipe):**
- **Títulos, chamadas grandes, números e palavras de destaque:** `font-family="Bebas Neue"`
  (um peso só; não use `font-weight` nela). Ela só tem maiúsculas: escreva o título em CAIXA ALTA.
  A assinatura da Alle no título passa a ser o contraste de **cor**: a primeira parte em branco e
  a parte que importa em laranja (ou branco sobre o card laranja), podendo ser um pouco maior.
- **Texto de apoio, listas, botões, rodapé e tudo que for lido em tamanho pequeno:**
  `font-family="Montserrat"` (pesos 300, 400, 500, 600, 700, 800, 900). Bebas Neue em texto
  corrido ou abaixo de 60 px fica difícil de ler.
- Nenhuma outra fonte.

**Tamanhos mínimos** (a peça é vista no celular a um terço do tamanho real):
título em Bebas Neue 110–200 px (ela é estreita: precisa ser maior que a Montserrat para ter o
mesmo peso visual), texto de apoio 34–44 px, rodapé/@ 26–30 px. Nada abaixo de 26 px.

**Logo** (use como `<image href="alle:…">`, mantendo a proporção):

| href | proporção | quando |
| --- | --- | --- |
| `alle:logo` | 1200×353 | fundo claro |
| `alle:logo-branco` | 1200×353 | fundo roxo ou foto escura (o raio tem metade laranja) |
| `alle:logo-branco-limpo` | 1200×353 | igual ao logo branco, **sem a frase "autonomia e liberdade energética"** (que some no roxo): prefira este sobre fundo roxo |
| `alle:logo-mono` | 1200×353 | logo todo branco: fundo laranja |
| `alle:raio` | 376×600 | o raio sozinho, fundo claro |
| `alle:raio-branco` | 376×600 | o raio sozinho (branco e laranja), fundo roxo ou escuro |
| `alle:raio-mono` | 376×600 | o raio sozinho, todo branco: fundo laranja e marca d'água |
| `alle:allpfit-mono` | 1271×275 | logo da Allp Fit todo branco: só quando o fundo for laranja (o ícone laranja sumiria) |
| `alle:allpfit-branco` | 1279×276 | **logo oficial da Allp Fit, laranja e branca** (ícone laranja, texto branco): é a PADRÃO da parceria em fundo roxo ou escuro |
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
| `alle:ane-tablet` | 900×1297 | de frente, segurando o tablet com uma fatura da Alle (camisa polo roxa) | fatura, desconto, passo a passo, "manda a sua conta" |
| `alle:ane-ombro` | 742×1020 | de costas, olhando por cima do ombro | "arrasta pro lado", curiosidade; use no canto direito, ela olha para o texto |
| `alle:ane-sorrindo` | 874×1006 | de frente, cabelo solto, sorriso aberto (fotos novas) | convite, CTA, "fala comigo". O lado direito da foto é cortado: use SEMPRE encostada na borda direita da arte |
| `alle:ane-queixo` | 883×1000 | mão no queixo, pensativa e sorrindo | pergunta, dúvida, "você sabia?", quebra de objeção |
| `alle:ane-costas` | 773×1020 | de costas, olhando para trás e sorrindo | "arrasta pro lado", curiosidade; use no canto direito, ela olha para o texto |
| `alle:ane-rabo` | 842×998 | rabo de cavalo, braços cruzados, sorrindo (fotos de 24/11) | confiança, oferta, capa, CTA |
| `alle:ane-ombro-2` | 718×999 | de costas, olhando por cima do ombro, cabelo solto (24/11) | "arrasta pro lado", curiosidade; use no canto direito, ela olha para o texto |
| `alle:ane-solta` | 866×1000 | de frente, cabelo solto, sorrindo (24/11) | convite, CTA, "fala comigo". O ombro direito é cortado: use SEMPRE encostada na borda direita da arte |
| `alle:ane-coque-2` | 872×1000 | coque, braços cruzados, sorrindo (24/11) | confiança, oferta, capa |
| `alle:ane-oculos-2` | 997×1000 | ajustando os óculos com a mão, sorrindo (24/11) | dica, "olha isso", "você sabia?", atenção a um detalhe |
| `alle:ane-tras` | 746×1000 | de lado, olhando para trás, cabelo solto (24/11) | "arrasta pro lado", curiosidade; use no canto direito, ela olha para o texto |
| `alle:ane-polo` | 732×1000 | de frente, camisa polo roxa com o logo da Alle, rabo de cavalo e óculos (24/11) | institucional, atendimento, posts no fundo branco (M38) |

**Alterne as fotos (são 15):** prefira as fotos mais novas (de 24/11: ane-rabo, ane-ombro-2, ane-solta, ane-coque-2, ane-oculos-2, ane-tras; e ane-sorrindo, ane-queixo, ane-costas), escolha a pose que combina com o tema do post e nunca use a mesma foto em todas as artes da semana; não repita a mesma foto em dois posts seguidos do calendário e, num
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
- **Alterne o LUGAR da Ane (pedido da equipe, 23/11/2026):** não deixe a Ane sempre no canto
  inferior direito. Varie de uma peça para a outra (e entre as artes da mesma semana) entre:
  1. canto inferior **direito**, com o texto à esquerda;
  2. canto inferior **esquerdo**, com o texto à direita (alinhe o texto à direita ou numa coluna
     que começa depois dela);
  3. **centro**, embaixo, grande, com o título em cima ocupando a largura;
  4. **meio corpo grande** ocupando metade da arte (de 900 a 1100 px de altura), com o título
     ao lado, em coluna estreita.
  Nas posições 2, 3 e 4, use só as fotos sem corte nas laterais: `alle:ane`, `alle:ane-queixo`,
  `alle:ane-costas`, `alle:ane-rabo`, `alle:ane-ombro-2`, `alle:ane-coque-2`, `alle:ane-oculos-2`,
  `alle:ane-tras`, `alle:ane-polo`. A `alle:ane-sorrindo` e a `alle:ane-solta` têm o lado direito cortado: só na
  posição 1, com a foto passando da borda direita. Nunca espelhe a foto para trocar de lado (o logo da camiseta
  fica invertido).
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
- **Fundo branco pronto (`alle:fundo-branco`, 1080×1350, criado em 24/11/2026 a partir de uma referência de post da
  equipe):** `<image href="alle:fundo-branco" x="0" y="0" width="1080" height="1350"/>` como primeira camada. Ele já
  tem a faixa roxa do topo, o logo da Alle centralizado (y 80–177), traçados discretos do raio da Alle no fundo, o card roxo arredondado no meio (x 50–1030, y 860–1080) e a faixa roxa do rodapé
  (y 1272–1350). Monte por cima: **título centralizado em y 220–380** (texto roxo-escuro `#3d0b80` e destaque em
  `#7c00ae` ou laranja; aqui o fundo é branco, então texto escuro é o certo), **pessoa recortada no centro** saindo
  do card, com a cabeça logo abaixo do título (de y≈400 até y≈1080: ~680 px de altura, nunca cobrindo o título), **texto de apoio centralizado em y 1110–1240** e nada
  no rodapé. Não use nas artes da parceria com a Allp Fit (lá o padrão é o fundo roxo).

Alterne roxo e laranja ao longo de um carrossel (ex.: capa roxa, miolo
laranja/claro, CTA roxo) para dar ritmo sem perder a unidade.

## Texto no SVG

O SVG **não quebra linha sozinho**. Quebre você, com `<tspan x="…" dy="…">`.
Na **Bebas Neue** (títulos), cada caractere ocupa cerca de 0,34 × o tamanho da fonte: com 920 px
de largura útil cabem ~19 caracteres a 140 px, ~16 a 170 px e ~13 a 200 px. Entrelinha do título
em Bebas Neue: 0,95 a 1,0× o tamanho (as letras não têm partes que descem).
Para estimar quantos caracteres cabem numa linha de Montserrat:
largura disponível ÷ (tamanho da fonte × 0,6) no peso 800, × 0,55 no 400,
× 0,52 no 300. Com 920 px de largura útil: ~15 caracteres a 100 px/800,
~19 a 80 px/800, ~40 a 40 px/400. Na dúvida, fonte menor ou menos palavras.

Entrelinha: 1,1 a 1,15× o tamanho no título; 1,35× no texto corrido.
Escape `&` como `&amp;` e `<` como `&lt;` dentro do texto.

## Ícones 3D (use no lugar de desenhos à mão)

Para objetos e ícones, prefira os **ícones 3D da marca** a desenhar em SVG (pedido da equipe, 25/11/2026: "elementos
mais bonitos, 3D, e não desenho"). São do pacote 3dicons (licença CC0), no estilo degradê rosa → laranja → roxo, que
combina com a Alle. Use `<image href="alle:icone-<nome>" …/>` mantendo a proporção (largura = altura × w/h):

| nome | w×h | | nome | w×h | | nome | w×h |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `lampada` | 328×322 | | `raio` | 195×347 | | `celular` | 261×328 |
| `check` | 272×196 | | `conversa` | 327×297 | | `mensagem` | 312×301 |
| `calendario` | 309×346 | | `relogio` | 287×350 | | `presente` | 331×323 |
| `saco-dinheiro` | 309×331 | | `carteira` | 335×346 | | `cadeado` | 261×319 |
| `escudo` | 288×330 | | `chave` | 297×204 | | `megafone` | 319×335 |
| `foguete` | 282×287 | | `estrela` | 303×309 | | `alvo` | 362×297 |
| `halter` | 349×271 | | `joinha` | 366×307 | | `coracao` | 326×324 |
| `grafico` | 311×329 | | `documento` | 338×336 | | | |

- Tamanho: até ~380 px de altura (o original tem 400 px); um ícone grande em destaque e 1 ou 2 menores
  flutuando (girados ±10°) ficam bonitos. Uma sombra elíptica suave embaixo dá chão ao objeto.
- Combina com: cartões de pergunta e resposta (ícone à esquerda), passo a passo (um ícone por passo), card do
  número (ícone saindo da borda do card), ao lado da Ane.
- Não use cifrão (`$`): o pacote só tem dólar; para dinheiro use `saco-dinheiro` ou `carteira`.

## Fotos

Use `search_photos` para achar fotos (pessoas reais, casas, telhados com
painel solar, conta de luz, comércio, academia…). Prefira fotos verticais
para `feed_4x5` e `story_9x16`. Use a `url` grande no `<image>`, com
`preserveAspectRatio="xMidYMid slice"` e as dimensões da área. Sempre ponha
uma camada escura ou um degradê (roxo `#44015e` a 70–85% de opacidade) entre a
foto e o texto. Texto direto sobre foto sem camada é proibido.
Nunca use foto com marca, logo ou texto de terceiros em destaque.

## Alterne layout e elementos (pedido da equipe, 23/11/2026)

Não repita a mesma composição em peças seguidas nem na mesma semana. Varie:
- **o eixo:** texto à esquerda, texto à direita, tudo centralizado, ou a arte dividida em cima e
  embaixo;
- **onde fica o título:** no topo, no meio ou embaixo;
- **o elemento do meio:** palavra gigante em contorno, raio da marca, objeto do tema (lâmpada,
  conta de luz, celular, halter), número ou nenhum;
- **o tipo de card:** card arredondado, pílula laranja, faixa atravessada, selo circular ou só texto;
- **o enquadramento da foto:** cena aberta, detalhe em close, ou pessoa em primeiro plano.

Antes de desenhar, olhe as últimas peças entregues (no calendário ou na conversa) e escolha uma
combinação diferente. Diga na entrega qual combinação usou.

## Layouts do carrossel

1. **Capa:** logo no topo, título em Bebas Neue (branco + laranja) ocupando o terço de baixo, uma
   linha de promessa, "Desliza →" e "@alleenergia" no rodapé.
2. **Conteúdo:** título de 3 a 7 palavras em Bebas Neue, até 25 palavras de apoio em
   Montserrat (400–500). Uma ideia por slide.
3. **Resumo:** lista curta, feita para print e para mandar a alguém.
4. **CTA:** uma ação só, em destaque; logo completo; @alleenergia.

Sem numeração: nada de `n/N` no canto nem número grande ao fundo (pedido da
equipe). Se a ordem importar (passo a passo, lista), use um selo pequeno
"PASSO 2 DE 3" ou o número dentro de um círculo ao lado do título.

## Modelos de referência (leia antes de desenhar)

Antes de desenhar qualquer post, carrossel ou capa, leia a biblioteca de modelos com
`read_file("skills/alle-design/referencias.md")`. São 30 modelos (numerados de M01 a M40; alguns números foram excluídos) estudados das
referências do setor e já adaptados à identidade Alle: número gigante, linha contínua entre slides,
documento anotado, mito ou verdade, prós e contras, simulação de economia, notícia no notebook etc.
Escolha um modelo que combine com o objetivo do card, varie em relação à última peça e diga na
entrega qual modelo usou. Se o usuário pedir "outro modelo" ou "outra opção", escolha um modelo
diferente da tabela, não só outra cor.

## Logo padrão: só a Alle (regra da equipe, 25/11/2026)

Toda arte usa **apenas o logo da Alle Energia**. Os logos da parceria (Allp Fit + Alle) e o layout da
parceria abaixo entram **somente quando a equipe pedir** (no pedido, na pauta ou nas observações), por exemplo
num post em collab com a @allpfit ou nas artes das academias. Na dúvida, só a Alle, e o texto fala com o público
geral da Alle, não com "aluno Allp Fit".

## Layout da parceria com a Allp Fit (quando a equipe pedir)

Todo post, capa ou arte que fala da parceria Alle + Allp Fit segue o estilo do
post real em collab com a @allpfit:

- **Fundo roxo profundo** (`#5A16A8`, com uma camada `#3d0b80` a ~35%) e
  **faixas diagonais em degradê laranja** (`#ff6a00` → `#ff8a1f`, de
  transparente a ~90%): uma no canto superior direito, outra entrando pela
  esquerda na altura do terço de baixo.
- **Co-branding no topo à esquerda:** `alle:allpfit-branco` (logo oficial
  laranja e branca da Allp Fit) + "+" branco + `alle:logo-branco`, do mesmo
  tamanho visual (mesma altura de letra). Não use a versão toda branca
  (`alle:allpfit-mono`) no roxo: ela é só para fundo laranja.
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
- **Texto e CTA:** siga a seção "Comunicação da parceria Alle Energia + Allp Fit" do estrategia.md: vantagem exclusiva esperando pelo aluno, sem afirmar que ele já tem o desconto e sem tom promocional; varie o CTA usando o banco de CTAs de lá.

## Padrões pedidos pela equipe (valem para todas as artes)

- **Sem @ no rodapé dos slides** ("@alleenergia", "@alleenergia + @allpfit"): a marcação vai só na legenda.
  Exceção (24/11/2026, pedido da equipe): no fundo branco do modelo M38 a faixa roxa do rodapé traz o ícone
  branco do Instagram com @alleenergia e o do WhatsApp com (12) 95369-7411 (já vêm no `alle:fundo-branco` e no
  `skills/alle-design/fundo-branco.svg`); não tire esse rodapé.
- **Último slide do carrossel sem a seta** de "arrasta": é o fechamento.
- Sobre fundo roxo, use o `alle:logo-branco` (a frase "autonomia e liberdade energética" já vem legível) ou o `alle:logo-branco-limpo` quando o logo for pequeno.
- Desconto: **até 35% para PJ e até 15% para PF**. Para alunos da Allp Fit (em geral PF), não prometa 35%.

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
