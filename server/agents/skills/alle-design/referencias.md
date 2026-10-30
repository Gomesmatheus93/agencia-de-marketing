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
| explicar como funciona (passo a passo) | M07, M08, M09, M21, M22 |
| derrubar objeção ou mito | M03, M04, M05, M18, M19 |
| mostrar dado, número ou economia | M01, M10, M11, M12, M23 |
| emocionar, institucional, data comemorativa | M14, M15, M16, M17, M29, M30 |
| dica rápida e salvável | M02, M06, M13, M20 |
| engajar (comentário, enquete, compartilhar) | M18, M24, M25, M26 |
| notícia do setor (bandeira, tarifa, lei) | M27, M28 |
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

**M22 · Quadrinhos / tirinha.** Um carrossel de 5 a 8 quadros em que um cliente desconfiado
conversa com a Ane (ou um consultor), com balões de fala: "Mas preciso instalar alguma coisa?" →
"Não! A energia vem da usina e o desconto chega na sua conta." Desenhe em SVG plano: personagens
simples (círculo de rosto, corpo em forma), balões brancos com rabicho e fundo laranja ou
off-white. Use quando o tema for objeção.
*Referência: Prime Energy (tirinha "Onde eu assino?"), Energês "Integrador × Consultor".*

## Objeções e mitos

**M03 · Mito ou verdade com selos.** Uma frase de mito em cada slide, numa pílula grande, com um
selo ✗ vermelho (`#E5484D`) ou ✓ verde (`#2EB872`) na ponta. A capa traz o número gigante ("3 mitos
e 1 verdade sobre a sua conta de luz"). A explicação vem abaixo, em 400. Verde e vermelho aparecem
só nos selos; o resto fica roxo/laranja.
*Referência: Simple "3 mitos e uma verdade", Abradee "Pode?".*

**M04 · Na teoria × Na prática / Antes × Depois.** A arte é dividida ao meio na vertical. Cada
metade tem um rótulo em caixa alta no topo e uma legenda curta embaixo. O lado "antes" fica
dessaturado (cinza, `filter` ou camada escura) e o "depois" fica colorido com a Alle. Exemplos:
"conta de luz antes" × "conta com a Alle", "o que você acha que precisa (obra, placa, contrato)" ×
"o que realmente precisa (enviar a fatura)".
*Referência: Energês "Na teoria / Na prática" e "Integrador amador × Consultor".*

**M05 · Pergunta da dúvida em balões.** Dois ou três balões de chat brancos ("E qual a vantagem?",
"Tem fidelidade?", "Por que é de graça?") flutuam no topo, e a resposta vem embaixo em 700. Bom para
o FAQ. Se o balão imitar o WhatsApp, use um layout genérico (sem logo nem interface do app).
*Referência: Detronic "E qual a vantagem? / Por que aderir?".*

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

**M06 · Textura + título.** Uma foto de textura ocupa o fundo inteiro (água, grama, plástico, papel
amassado, superfície de painel solar) com uma camada roxa a 60–75%. Título curto de 2 linhas no topo
à esquerda (800, branco) e uma seta → laranja no canto inferior esquerdo. É ideal para listas de
dicas em carrossel, uma por slide.
*Referência: Detronic "Reduza o uso de água e energia", "Use apenas lâmpadas de LED".*

**M13 · Bloco de notas.** Imitação de um app de notas genérico: fundo branco, "‹ Notas" no topo,
itens com raio laranja como marcador e "1/2" no rodapé. Parece um print salvo, e as pessoas salvam.
Use para checklists ("antes de aderir, tenha em mãos: ...").
*Referência: Detronic (notas com dicas sustentáveis).*

**M20 · Grade de ícones em cards.** Uma grade de 2×3 ou 3×2 com cards arredondados, cada um com um
ícone e um rótulo curto (geladeira, ar, chuveiro, máquina, TV). Cards alternando branco e roxo
escuro. Título em cima: "5 aparelhos que mais pesam na conta".
*Referência: Click "5 eletrodomésticos que mais consomem".*

## Emoção, marca e datas

**M14 · Série emocional com foto lifestyle.** Uma foto real ocupando a arte inteira (família em
casa, pessoa treinando, café da manhã, banho quente) e uma frase de 3 linhas no topo à esquerda em
500, branca, sem caixa: "Energia que te acorda pro treino.", "Energia que esquenta o banho.",
"Energia que cabe no seu bolso." O logo fica pequeno embaixo. Faça como série: cada post repete o
começo "Energia que…". Coloque um degradê escuro só na faixa do texto.
*Referência: Galp "Energia que te uniu a milhões / que te aqueceu o coração".*

**M15 · Foto com recorte curvo e moldura de linha.** Uma foto de pessoa sorrindo ocupa 60% da arte,
com uma borda curva (arco grande branco ou laranja entrando pelo canto). Uma linha fina laranja
forma um "L" ou uma moldura parcial ao redor do título, que fica no canto. Título em 800 com uma
palavra em laranja e um chip de destaque abaixo ("100% digital").
*Referência: Evolua (fotos com moldura amarela), Abradee (anel curvo), Maya (foto em arco).*

**M16 · Palavra repetida com objeto no meio.** "ENERGIA" escrito 3 vezes empilhado (900, 200 px,
uma linha laranja e duas roxas ou contorno), com um objeto recortado na frente cobrindo parte das
letras: lâmpada, raio da Alle, celular. Embaixo, a data ou a mensagem. Bom para datas (Dia Mundial
da Energia, 29/5) e capas de impacto.
*Referência: Detronic e Maya "ENERGIA ENERGIA ENERGIA".*

**M17 · Card de data em cor chapada.** Fundo laranja-pêssego (`#FFD9BF`) ou roxo chapado e uma frase
grande em 600 com a palavra-chave em 800: "Se outubro fosse uma cor, seria verde." (bandeira
verde). O logo fica no rodapé. É minimalista: nada de fotos ou ícones.
*Referência: FNCE "Se 2024 fosse uma palavra, seria Energia", Galp "Feliz 2025!".*

**M29 · Foto conceitual criativa.** Um objeto do dia a dia transformado no tema da data: lâmpada com
óculos e bigode (Carnaval), lâmpada saindo de um ovo (Páscoa), lâmpada feita de serpentina. Fundo de
cor chapada roxo ou laranja, o objeto no centro, uma frase curta em cima e uma faixa com o logo
embaixo. Use foto de banco que tenha o objeto e componha no SVG.
*Referência: Luzigás (datas comemorativas).*

**M30 · Split visual (meio a meio).** Duas fotos cortadas exatamente ao meio na vertical, que se
completam como metáfora: painel solar | girassol, poste | árvore, conta de luz cara | sorriso. Sem
texto ou com uma linha curta. O logo vai pequeno.
*Referência: EDP (painel | girassol, turbina | dente-de-leão, poste | árvore).*

## Engajamento

**M24 · Pergunta para os comentários.** Uma pergunta grande (800, 90 px): "Você já sabia disso?",
"Quanto veio a sua conta este mês?", e embaixo "Conta pra gente nos comentários 👇". Os ícones de
curtir, comentar, enviar e salvar ficam no rodapé. Use como último slide de carrosséis educativos.
*Referência: Simple "Você já tinha conhecimento disso?", Backoffice "CURTE · COMPARTILHA · SALVA".*

**M25 · Comente e receba.** Último slide: "Comente ECONOMIA e receba no direct como ter até 35% de
desconto". A palavra-chave fica em destaque laranja numa pílula. Combina com a automação de
comentários da plataforma, então use uma palavra-chave que exista numa automação ativa e confirme
com a equipe.
*Referência: Energês "Comente BIFACIAL e receba a planilha no seu direct".*

**M26 · Jogo / escolha.** "Escolha 1 letra e 1 número" sobre uma grade de ícones (A–D × 1–4) que
revelam benefícios: "sem fidelidade", "100% digital", "sem obra". Também funciona como enquete
visual ("Você é time ventilador ou ar-condicionado?").
*Referência: Detronic "Escolha 1 letra e 1 número", Evolua "Ventilador × Ar-condicionado".*

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
