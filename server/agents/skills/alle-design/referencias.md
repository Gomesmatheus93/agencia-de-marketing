# Biblioteca de referências: modelos de post e carrossel

Estudo de cerca de 750 peças do setor de energia (Abraceel, Abradee, Bulbe, CCEE, Click, Detronic,
EDP, Energês, Evolua, FNCE, Galp, Lightsource bp, Luzigás, Matrix, Maya, NEX, Pan Energy, Prime
Energy, (re)energisa, Simple, Solar Finance e outras), feito pela equipe em 28/10/2026. A pasta
original é "REFERENCIA CONCORRENTES - IDEIAS".

Cada modelo abaixo já está **traduzido para a identidade Alle**: roxo `#7B2FBE`/`#5B1D9A`/`#44015e`,
laranja `#F47B20`/`#ff7300`, off-white `#FFF8F2`, Montserrat e os logos `alle:*`. Copie a
**estrutura**, nunca as cores, os logos, os mascotes ou os textos dos concorrentes. As regras do
SKILL.md continuam valendo: zona segura, tamanhos mínimos, sem numeração "2/7", ressalva do "até 35%".

## Como escolher

1. Leia o tema e o objetivo do card do plano.
2. Escolha **um** modelo da tabela. Não misture três modelos numa peça só.
3. Num carrossel, a capa pode ser de um modelo e o miolo de outro, desde que as cores e a tipografia
   sejam as mesmas do começo ao fim.
4. Varie: não repita o modelo da última peça entregue, a menos que o pedido seja uma série.
5. Diga na entrega qual modelo usou (ex.: "modelo M07 · Linha contínua").

| objetivo | modelos |
| --- | --- |
| explicar como funciona (passo a passo) | M07, M08, M09, M21 |
| derrubar objeção ou mito | M03, M18, M19 |
| mostrar dado, número ou economia | M01, M10, M11, M12, M23, M33 |
| emocionar, institucional, data comemorativa | M15, M17, M32 |
| dica rápida e salvável | M02, M13, M20 |
| engajar (comentário, enquete, compartilhar) | M18, M26 |
| Black Friday (campanha) | M34, M35, M36, M37 |
| notícia do setor (bandeira, tarifa, lei) | M27, M28, M31 |
| parceria Allp Fit | layout próprio no SKILL.md (+ M10, M12 no miolo) |

---

## Dados e números

**M01 · Número gigante.** Um número ocupa metade da arte (`até 35%`, `R$ 0`, `3 em 10`), em 900 com
220–320 px, laranja sobre roxo. Acima, uma linha de apoio fina (300). Abaixo, a frase que dá sentido
ao número (500, 40 px). Variação: o número em contorno (`fill="none" stroke`) atrás do texto como
marca d'água. Só número real e com fonte; o "até 35%" leva a ressalva.
*Referência: Bulbe "Custa R$0", Detronic "15% de desconto", Abraceel "36% / 76% / 96%".*

**M10 · Simulação de economia.** Um card mostra "Sua conta de luz: R$ X" e, abaixo, quanto
economiza em 1, 5 e 10 anos. Use valores claramente ilustrativos (conta de R$ 300, até 35% → até
R$ 105/mês, até R$ 1.260/ano). É obrigatório o rodapé "Valores ilustrativos, simulação com desconto
máximo de 35%. A economia real depende da sua conta." Visual: card branco de cantos rx 32 sobre
roxo, rótulos em 500, valores em 800 laranja, seta ou degraus subindo.
*Referência: Pan Energy "Sua conta R$1.200 → 1/5/10 anos", NEX "Sem a NEX x Com a NEX".*

**M11 · Mapa do Brasil com destaque.** Silhueta do Brasil (ou de SP) em roxo-claro, com a área que
importa em laranja e um rótulo com o número. Bom para "onde atendemos", "a conta mais cara do país"
e dados por estado. Desenhe o mapa simplificado com `<path>` ou use foto. Nunca invente percentuais
por estado.
*Referência: Detronic "43% inadimplentes", Energês "mapa de rentabilidade", Pan "Brasil avança".*

**M12 · Comparativo "Sem a Alle × Com a Alle".** Duas colunas lado a lado com cards de cantos
arredondados. A da esquerda fica apagada (cinza/roxo escuro, ✗) e a da direita é a Alle (laranja,
✓). Use 3 ou 4 linhas curtas por coluna: "paga a tarifa cheia" × "até 35% de desconto", "obra no
telhado" × "sem obra", "fidelidade" × "sem fidelidade". Variações: título "Troque isso → Por isso",
com setas `>>>` entre as pílulas, ou polegar para cima/para baixo.
*Referência: Click "Troque isso / Por isso", Maya "Cliente", Detronic "Assinatura × Painel solar",
NEX "Sem × Com".*

**M23 · Barras ou degraus.** Um gráfico simples de 3 a 5 barras (`<rect>` com rx) e o valor em cima
de cada uma. Destaque a barra que importa em laranja e deixe as outras em roxo-claro. Use para a
escada das bandeiras (verde → amarela → vermelha 1 → vermelha 2, com o acréscimo por 100 kWh) ou
para comparações. Os valores precisam ser os oficiais da ANEEL do período, com a fonte no rodapé.
*Referência: Abradee/FNCE setas das bandeiras, (re)energisa escadinha, Solar Finance barras.*

**M33 · Número com mapa e pessoa.** Topo claro com o mapa do Brasil (como no M11) e os estados
atendidos em roxo e laranja. Sobre o mapa, um card roxo arredondado com um número grande em 900
branco ("+X", "X mil") e a legenda em 800 laranja logo abaixo. Embaixo, uma faixa roxa com uma frase
curta em 2 linhas ("Milhares de clientes. Uma economia real.") e o logo, e uma pessoa recortada
sorrindo com o celular encostada na borda de baixo à direita (a Ane ou uma foto de banco). Só número
real e com fonte: nunca invente a quantidade.
*Referência: FIT Energia "+26 distribuidoras atendidas" (23/11/2026).*

## Explicar e ensinar

**M07 · Linha contínua entre slides.** Fundo off-white `#FFF8F2`, opcionalmente com uma textura
leve de papel (ruído com opacidade de 3%). Uma linha laranja de 6 px corre pelo carrossel inteiro:
entra pela borda esquerda, contorna o bloco de texto em L ou U, passa por um ícone e sai pela borda
direita exatamente na mesma altura em que entra no slide seguinte. Isso dá a sensação de um slide
puxando o outro. Título em 800 laranja e texto em 400 `#1E0A01`. Ícones lineares laranja (lâmpada,
raio, casa, tomada). É o melhor modelo para passo a passo.
*Referência: Evolua (série inteira), Simple "3 mitos".*

**M08 · Documento anotado.** No centro, a imagem da conta de luz (ou de um contrato), inclinada ou
reta. Ao redor, caixas roxas com texto branco ligadas por linhas finas a cada parte ("aqui está o
seu consumo em kWh", "aqui as bandeiras", "aqui entra o crédito da Alle"). É ótimo para "entenda a
sua conta". Use a conta de exemplo, sem dados reais de cliente (borre nome, endereço e número de
instalação).
*Referência: Energês "Análise das condições comerciais" (fluxograma sobre o contrato).*

**M09 · Fluxo / diagrama.** Ícones em sequência ligados por setas: usina solar → rede da
distribuidora → créditos → sua conta mais barata. Use 3 a 5 etapas numeradas em círculos laranja.
Pode ser horizontal, numa arte só, ou um passo por slide.
*Referência: Energês "Entenda o processo", Detronic "como a energia chega até você".*

**M21 · Etapas com selo.** Cada slide tem o selo "ETAPA 1" (ou "PASSO 1 DE 3") numa pílula
laranja, um título curto em 800 e duas linhas de explicação. Pode ter uma faixa diagonal ou um
semicírculo laranja atrás de um objeto recortado (celular, conta de luz, painel). Para a adesão,
use os passos reais da base de conhecimento: valor da conta → envio da fatura → análise → termo
pela Clicksign → desconto em até 90 dias.
*Referência: Solar Finance "ETAPA 1/2/3", CCEE "migração ao mercado livre, um passo de cada vez".*

## Objeções e mitos

**M03 · Mito ou verdade com selos.** Uma frase de mito em cada slide, numa pílula grande, com um
selo ✗ vermelho (`#E5484D`) ou ✓ verde (`#2EB872`) na ponta. A capa traz o número gigante ("3 mitos
e 1 verdade sobre a sua conta de luz"). A explicação vem abaixo, em 400. Verde e vermelho aparecem
só nos selos; o resto fica roxo/laranja.
*Referência: Simple "3 mitos e uma verdade", Abradee "Pode?".*

**M18 · Prós × Contras com interruptor.** Uma interface fictícia com um toggle desenhado (pílula com
bolinha): "PRÓS" ligado (laranja, bolinha à direita) e "CONTRAS" desligado (cinza). Em cada slide,
um card branco arredondado com um ponto e uma foto em cantos arredondados. Funciona bem para
debates ("horário de verão vale a pena?") e para comparar opções (placa própria × energia por
assinatura).
*Referência: Matrix "Horário de verão: prós e contras".*

**M19 · "Você quis dizer:" (busca).** Uma barra de busca genérica desenhada (retângulo rx 40, lupa,
cursor) com o termo errado ("placa solar") e, embaixo, "Você quis dizer: energia sem obra e com
até 35% de desconto". Não use o logo do Google: faça uma busca genérica.
*Referência: Click "Placa Solar / Você quis dizer", Luzigás busca.*

## Dicas salváveis

**M02 · Dica com ícone linear.** Fundo off-white ou roxo. Um ícone grande de linha (stroke 6, sem
preenchimento, laranja) no terço de cima: ar-condicionado, chuveiro, geladeira, tomada. Embaixo, o
título da dica em 700 e uma frase de "por quê" em laranja 600. Um slide por aparelho e uma ideia por
slide.
*Referência: Abradee (série "Verão inteligente"), Evolua, Detronic.*

**M13 · Bloco de notas.** Imitação de um app de notas genérico: fundo branco, "‹ Notas" no topo,
itens com raio laranja como marcador e "1/2" no rodapé. Parece um print salvo, e as pessoas salvam.
Use para checklists ("antes de aderir, tenha em mãos: ...").
*Referência: Detronic (notas com dicas sustentáveis).*

**M20 · Grade de ícones em cards.** Uma grade de 2×3 ou 3×2 com cards arredondados, cada um com um
ícone e um rótulo curto (geladeira, ar, chuveiro, máquina, TV). Cards alternando branco e roxo
escuro. Título em cima: "5 aparelhos que mais pesam na conta".
*Referência: Click "5 eletrodomésticos que mais consomem".*

## Emoção, marca e datas

**M15 · Foto com recorte curvo e moldura de linha.** Uma foto de pessoa sorrindo ocupa 60% da arte,
com uma borda curva (arco grande branco ou laranja entrando pelo canto). Uma linha fina laranja
forma um "L" ou uma moldura parcial ao redor do título, que fica no canto. Título em 800 com uma
palavra em laranja e um chip de destaque abaixo ("100% digital").
*Referência: Evolua (fotos com moldura amarela), Abradee (anel curvo), Maya (foto em arco).*

**M17 · Card de data em cor chapada.** Fundo laranja-pêssego (`#FFD9BF`) ou roxo chapado e uma frase
grande em 600 com a palavra-chave em 800: "Se outubro fosse uma cor, seria verde." (bandeira
verde). O logo fica no rodapé. É minimalista: nada de fotos ou ícones.
*Referência: FNCE "Se 2024 fosse uma palavra, seria Energia", Galp "Feliz 2025!".*

**M32 · Foto escura com moldura de linha (carrossel institucional).** Cada slide é uma foto que
ocupa a arte inteira (mãos juntas, painéis solares ao pôr do sol, aperto de mão, prédio), com uma
camada roxo-escura de 60–70%. Uma linha branca fina (4 px, cantos arredondados) forma uma moldura
aberta que sai pela borda lateral e continua no slide seguinte, como no M07. O título fica em
caixa alta, com a primeira parte em 300 branco e a palavra-chave em 900 laranja ("NÃO SÓ UM
DESCONTO, MAS / UM COMPROMISSO COM VOCÊ"). Um texto curto de 2–3 linhas em 400 branco fica dentro
da moldura, com 2 ou 3 palavras em laranja. No último slide, um quadro de linha com o
agradecimento ("Obrigado a cada cliente que confia na Alle") e o logo branco. Bom para prêmio,
aniversário, marco e valores da marca.
*Referência: FIT Energia, carrossel "Prêmio Reclame Aqui 2026" (23/11/2026). Na Alle, só cite
prêmio ou marco real.*

## Engajamento

**M26 · Jogo / escolha.** "Escolha 1 letra e 1 número" sobre uma grade de ícones (A–D × 1–4) que
revelam benefícios: "sem fidelidade", "100% digital", "sem obra". Também funciona como enquete
visual ("Você é time ventilador ou ar-condicionado?").
*Referência: Detronic "Escolha 1 letra e 1 número", Evolua "Ventilador × Ar-condicionado".*

## Black Friday (campanha sazonal)

Estudo de peças de Black Friday enviadas pela equipe em 23/11/2026 (FIT Energia e modelos de banco).
Nesta campanha o fundo pode ser **preto** (`#0B0710`) com brilho roxo (`#7B2FBE`) e os destaques em
laranja (`#ff7300`) ou em degradê neon laranja→amarelo-claro (`#ff7300` → `#FFD27A`): é a "edição
Black" da Alle. Nunca invente promoção, parcelamento, "o dobro", "até 60%" ou prazo de Black Friday:
a Alle não tem condição especial; o que muda é a moldura. PJ até 35% e PF até 15%, com a ressalva.

**M34 · Fitas e etiqueta.** Fundo preto com 2 ou 3 fitas (faixas laranja ou roxas de ~70 px)
atravessadas na diagonal, com "BLACK FRIDAY DA ALLE ·" repetido em 800 branco. No centro, uma etiqueta
de preço inclinada (retângulo com a ponta cortada e um furo com cordão) em laranja com "Black" em 900
branco e, embaixo, uma faixa com "FRIDAY" em contorno. Abaixo, a frase da pauta e um bloco com 2
destaques reais (ex.: "TODO MÊS", "SEM FIDELIDADE") em cards laranja.
*Referência: "Black Friday · Aguardem" (fitas e etiqueta vermelha).*

**M35 · Cupom destacável.** Fundo preto com textura de pontos e um raio da Alle grande e sutil. No
centro, um cupom branco inclinado (~-8°) com dois recortes semicirculares nas laterais, uma linha
picotada separando o canhoto laranja (escrito "CUPOM" na vertical) e o corpo: "BLACK FRIDAY DA ALLE" e a
vantagem real em 900 ("DESCONTO TODO MÊS"). Em cima, o título em 2 pesos; embaixo, um botão de
contorno branco com o CTA.
*Referência: "Black Friday Sale · Up to 50% coupon" (cupom vermelho e preto).*

**M36 · Título neon com objetos.** Fundo preto com brilho no centro. No topo, uma linha de apoio em
caixa alta e "BLACK / FRIDAY" gigante em 900: a primeira palavra branca e a segunda em degradê neon,
com um brilho (`feGaussianBlur` de uma cópia do texto atrás). No meio, objetos do tema empilhados com
sombra (conta de luz, celular com a conversa da Ane, e, para a Allp Fit, tênis e halter): use fotos
de banco sem fundo ou ícones grandes desenhados. Embaixo, a frase de virada em 2 pesos ("A economia da
sua conta de luz / vale o mês inteiro") e o CTA em laranja. Selo circular laranja no canto só com
fato real ("TODO MÊS", "SEM FIDELIDADE").
*Referência: FIT Energia "A economia que paga a sua Black Friday".*

**M37 · Teaser "prepare-se".** Só tipografia centralizada no preto, com brilho: "PREPARE-SE PARA"
(800, branco) / "ECONOMIZAR" (900, degradê neon) / "AINDA MAIS NA SUA" / "BLACK FRIDAY" (900 gigante,
"BLACK" branco e "FRIDAY" neon). Embaixo, a pergunta que gera curiosidade e a data da revelação
("E o que a Alle tem a ver com a Black? Dia 27/11 você descobre."). Logo branco no rodapé. Bom para a
abertura da semana e para stories.
*Referência: FIT Energia "Prepare-se para economizar ainda mais na sua Black Friday".*

## Notícias e setor

**M27 · Notícia em formato portal.** Uma foto no topo (60%), uma faixa branca embaixo com um chip
de categoria em laranja ("BANDEIRA", "TARIFA", "LEI") e a manchete em 800 roxo, com uma fina borda
em degradê roxo→laranja na base. Bom para "Bandeira verde em outubro", "Aneel aprova reajuste".
Escreva a manchete com as próprias palavras da Alle e cite a fonte (ANEEL, CCEE) na legenda. Nunca
reproduza o layout ou o logo de um veículo real (CNN, Estadão) nem invente notícia.
*Referência: MegaWhat, Maya "Notícia", Prime Energy "BRASIL: no Top 3".*

**M28 · Recorte de manchetes.** Colagem de 2 ou 3 "recortes" de papel inclinados (retângulos
brancos com sombra, título serifado preto) sobre fundo roxo texturizado, com um título da Alle por
cima: "Todo mundo fala da conta de luz cara. A gente resolve." O texto dos recortes deve ser
genérico ou citar estudos reais com fonte, sem marca de jornal.
*Referência: Energês (colagem de manchetes), Abraceel "#NaMídia".*

**M31 · Notícia no notebook.** Fundo claro. No topo, o título em duas partes: o problema em 600
roxo ("A conta de luz pode ficar mais cara.") e a virada em 900 roxo com "Alle" em laranja ("Mas a
sua economia pode contar com a Alle!"). Logo abaixo, um botão laranja em pílula ("ATIVE AGORA",
"FALE COM A ANE"). Na metade de baixo, um notebook desenhado em perspectiva frontal com a tela
mostrando um portal de notícias GENÉRICO (barra com "NOTÍCIAS · ECONOMIA", a manchete em 800 e
uma foto) e o logo da Alle no rodapé. A manchete precisa ser real e com a fonte na legenda
(ANEEL, CCEE); nunca reproduza o logo ou o layout de um veículo de verdade.
*Referência: FIT Energia "A conta de luz pode ficar mais cara" (23/11/2026).*

---

## Estilos de acabamento (combinam com qualquer modelo)

- **Moldura neon.** Um retângulo arredondado de 2 px em laranja com `filter` de brilho (feGaussianBlur
  + merge) a 40 px da borda, em todos os slides do carrossel. Fica moderno sobre roxo escuro.
  *((re)energisa)*
- **Card de vidro.** Um retângulo branco a 12–18% de opacidade com borda branca a 30%, sobre foto,
  com o texto dentro. *(Detronic, Pan Energy)*
- **Pílula que atravessa a borda.** Um elemento (pílula com número, seta, faixa) cortado na borda
  direita de um slide que continua na borda esquerda do seguinte. *(NEX, Simple)*
- **Palavra em script.** Uma palavra do título em fonte manuscrita para dar calor. Como só temos
  Montserrat, use Montserrat 300 itálico (`font-style="italic"`) maior e em laranja. *(Pan Energy)*
- **Marca-texto.** Um retângulo laranja (ou roxo-claro) atrás de 2 a 4 palavras do texto, levemente
  inclinado (`rotate(-1.5)`). *(Bulbe, Abraceel, Energês)*
- **Anotação manuscrita.** Setas curvas desenhadas à mão (`<path>` com curvas irregulares, stroke 4,
  ponta aberta) e um rótulo curto apontando para algo na foto. *(Lightsource bp)*
- **Textura de papel.** Off-white com ruído sutil (`feTurbulence` baseFrequency 0.9, opacidade 0.04).
  *(Evolua, Energy as a Service)*
- **Faixa zebrada** (amarelo/preto) só em temas de alerta ou de segurança na rede elétrica. *(Solar
  Finance, EDP)*

## Reels (para o ig-reel e as capas de reels)

- **Legenda grande palavra a palavra** no centro inferior, com a palavra-chave em laranja ou com
  marca-texto. É o padrão de todos os cortes de podcast e entrevista.
- **Corte de conversa:** pessoa falando direto pra câmera, em plano médio, com a legenda queimada.
  Tem prioridade com gente real da equipe (Ane, comercial) e cliente só com autorização.
- **Texto sobre vídeo de natureza ou cidade** (drone, pôr do sol, painéis) com uma frase de 2 linhas
  sublinhada. *(EDP POV Sustentabilidade)*
- **Comparação visual:** "1 kWh = 10 lâmpadas de LED acesas por 1 hora", com ícones repetidos.
  *(Abradee)*
- **Print de post/tweet da própria marca** com meme ("Você recebendo a conta depois da bandeira
  vermelha"). Só a conta da própria Alle, nunca imitando outra pessoa ou marca. *(Bulbe, Detronic)*
- **Capa:** título curto em 2 linhas, rosto grande e logo pequeno. Nada acima de y=250 nem abaixo de
  y=1600.

## Proibido copiar dos concorrentes

- Depoimento com foto e estrelas sem cliente real autorizado (Detronic fazia). Na Alle, só com
  autorização por escrito.
- Prints de veículos de imprensa, de tweets de terceiros ou de apps com logo (Google, Tinder, CNN).
  Faça versões genéricas.
- Números de mercado sem fonte, "economize até 50%" e qualquer promessa acima do "até 35%".
- Memes com rosto de famosos ou personagens com direitos (Terry Crews, Joelma etc.).
